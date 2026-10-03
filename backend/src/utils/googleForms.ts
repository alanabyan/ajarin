import { latexToText } from './latextToText';
import type { SoalSetForExport } from './SoalWorkbook';

// Membuat Google Form bermode kuis dari satu set soal memakai Google Forms API.
// Dipanggil dengan access token milik guru (didapat di frontend lewat Google Identity Services),
// sehingga form dibuat di Google Drive guru sendiri. Token TIDAK disimpan.
//
// Alur: (1) forms.create -> (2) batchUpdate: jadikan kuis + tambah semua soal
//       -> (3) setPublishSettings (form buatan API setelah 30 Jun 2026 default-nya belum dipublikasi)
//       -> (4) opsional: izinkan "siapa saja yang punya link" mengisi.

const FORMS_API = 'https://forms.googleapis.com/v1/forms';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export interface HasilGoogleForm {
  formId: string;
  responderUri: string; // link untuk siswa
  editUrl: string; // link edit untuk guru
  jumlahSoal: number;
  soalDilewati: number; // soal yang tidak bisa dimasukkan (kunci tidak cocok / pilihan kurang)
  dipublikasi: boolean;
  bisaDiisiSiapaSaja: boolean; // false = guru perlu mengatur akses di Google Forms (tombol Kirim)
}

class GoogleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function googleFetch(url: string, accessToken: string, body?: unknown): Promise<any> {
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* respons bukan JSON */
  }

  if (!response.ok) {
    const pesanGoogle: string = data?.error?.message ?? text.slice(0, 200);
    if (response.status === 401) {
      throw new GoogleApiError('Sesi Google habis atau tidak valid. Coba login Google lagi.', 401);
    }
    if (response.status === 403) {
      throw new GoogleApiError(
        `Akses ditolak Google (pastikan Google Forms API aktif dan izin dicentang): ${pesanGoogle}`,
        403
      );    
    }
    throw new GoogleApiError(`Google Forms API error: ${pesanGoogle}`, 502);
  }
  return data;
}

// Pilihan Google Forms harus unik dan tidak kosong; teks hasil konversi LaTeX bisa kembar.
function uniqueOptions(opsi: string[], indeksKunci: number): { daftar: string[]; kunci: string } | null {
  const dipakai = new Set<string>();
  const daftar: string[] = [];
  let kunci = '';

  opsi.forEach((teks, idx) => {
    if (!teks) return;
    let nilai = teks;
    let n = 2;
    while (dipakai.has(nilai)) nilai = `${teks} (${n++})`;
    dipakai.add(nilai);
    daftar.push(nilai);
    if (idx === indeksKunci) kunci = nilai;
  });

  if (daftar.length < 2 || !kunci) return null;
  return { daftar, kunci };
}

export async function buatGoogleFormKuis(set: SoalSetForExport, accessToken: string): Promise<HasilGoogleForm> {
  // 1) Buat form kosong (forms.create hanya menerima judul).
  const form = await googleFetch(FORMS_API, accessToken, {
    info: { title: set.judul, documentTitle: set.judul },
  });
  const formId: string = form.formId;
  const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

  // 2) Siapkan soal.
  const items: unknown[] = [];
  let dilewati = 0;

  set.soal.forEach((s) => {
    const asli = Array.isArray(s.pilihanJawaban) ? (s.pilihanJawaban as string[]) : [];
    const indeksKunci = asli.indexOf(s.kunciJawaban);
    const opsi = uniqueOptions(
      asli.map((o) => latexToText(o)),
      indeksKunci
    );
    const pertanyaan = latexToText(s.pertanyaan);

    if (!opsi || !pertanyaan) {
      dilewati++;
      return;
    }

    const pembahasan = latexToText(s.pembahasan);
    items.push({
      createItem: {
        item: {
          title: pertanyaan,
          questionItem: {
            question: {
              required: true,
              grading: {
                pointValue: 1,
                correctAnswers: { answers: [{ value: opsi.kunci }] },
                whenRight: { text: pembahasan ? `Benar!\n\n${pembahasan}` : 'Benar!' },
                whenWrong: {
                  text: `Jawaban yang benar: ${opsi.kunci}${pembahasan ? `\n\n${pembahasan}` : ''}`,
                },
              },
              choiceQuestion: {
                type: 'RADIO',
                options: opsi.daftar.map((value) => ({ value })),
              },
            },
          },
        },
        location: { index: items.length },
      },
    });
  });

  if (items.length === 0) {
    throw new GoogleApiError('Tidak ada soal yang valid untuk dimasukkan ke Google Form.', 422);
  }

  // Form sudah terbuat di Drive guru; kalau langkah berikutnya gagal, beri tahu supaya bisa dihapus.
  try {
    // 2b) Jadikan kuis, isi deskripsi, tambahkan soal (satu batchUpdate).
    await googleFetch(`${FORMS_API}/${formId}:batchUpdate`, accessToken, {
      includeFormInResponse: false,
      requests: [
        {
          updateSettings: {
            settings: { quizSettings: { isQuiz: true } },
            updateMask: 'quizSettings.isQuiz',
          },
        },
        {
          updateFormInfo: {
            info: { description: `${set.mapel} · Kelas ${set.kelas}` },
            updateMask: 'description',
          },
        },
        ...items,
      ],
    });

    // 3) Publikasikan agar bisa menerima jawaban.
    await googleFetch(`${FORMS_API}/${formId}:setPublishSettings`, accessToken, {
      publishSettings: { publishState: { isPublished: true, isAcceptingResponses: true } },
    });
  } catch (err) {
    const e = err as GoogleApiError;
    throw new GoogleApiError(
      `${e.message} (Form sebagian sudah terbuat di Google Drive Anda dan boleh dihapus: ${editUrl})`,
      e.status ?? 502
    );
  }

  // 4) Best-effort: siapa saja yang punya link boleh mengisi. Butuh scope drive.file;
  //    kalau gagal, form tetap jadi dan guru mengatur akses sendiri lewat tombol "Kirim".
  let bisaDiisiSiapaSaja = false;
  try {
    await googleFetch(`${DRIVE_API}/${formId}/permissions`, accessToken, {
      type: 'anyone',
      view: 'published',
      role: 'reader',
    });
    bisaDiisiSiapaSaja = true;
  } catch {
    bisaDiisiSiapaSaja = false;
  }

  return {
    formId,
    responderUri: form.responderUri ?? `https://docs.google.com/forms/d/${formId}/viewform`,
    editUrl,
    jumlahSoal: items.length,
    soalDilewati: dilewati,
    dipublikasi: true,
    bisaDiisiSiapaSaja,
  };
}