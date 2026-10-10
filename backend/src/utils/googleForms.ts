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

// Judul dua pertanyaan identitas yang disisipkan di form buatan Ajarin; juga dipakai untuk
// mengenalinya kembali saat membaca jawaban.
const JUDUL_NAMA = 'Nama lengkap';
const JUDUL_NIS = 'NIS';
const JUMLAH_ITEM_IDENTITAS = 2;

function buatItemIdentitas(judul: string[]): unknown[] {
  return judul.map((title, index) => ({
    createItem: {
      item: { title, questionItem: { question: { required: true, textQuestion: { paragraph: false } } } },
      location: { index },
    },
  }));
}

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

  // 2) Siapkan soal. Dua pertanyaan identitas diletakkan paling awal supaya jawaban siswa
  //    bisa dicocokkan ke daftar siswa saat hasilnya diimpor sebagai nilai.
  const items: unknown[] = buatItemIdentitas([JUDUL_NAMA, JUDUL_NIS]);
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

  if (items.length === JUMLAH_ITEM_IDENTITAS) {
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
    jumlahSoal: items.length - JUMLAH_ITEM_IDENTITAS,
    soalDilewati: dilewati,
    dipublikasi: true,
    bisaDiisiSiapaSaja,
  };
}

export interface JawabanForm {
  nama: string;
  nis: string;
  skor: number; // skala 0-100
  waktu: string;
}

export interface HasilJawabanForm {
  jawaban: JawabanForm[];
  adaIdentitas: boolean; // false = form lama tanpa pertanyaan Nama/NIS
}

// Membaca jawaban siswa dari Google Form kuis dan mengubah skornya ke skala 0-100.
// Satu siswa (NIS sama) yang mengisi berkali-kali hanya dihitung jawaban terbarunya.
export async function ambilJawabanForm(formId: string, accessToken: string): Promise<HasilJawabanForm> {
  const form = await googleFetch(`${FORMS_API}/${formId}`, accessToken);

  let skorMaks = 0;
  let idNama = '';
  let idNis = '';
  for (const item of form.items ?? []) {
    const q = item.questionItem?.question;
    if (!q) continue;
    skorMaks += q.grading?.pointValue ?? 0;
    if (item.title === JUDUL_NAMA) idNama = q.questionId;
    if (item.title === JUDUL_NIS) idNis = q.questionId;
  }

  if (skorMaks <= 0) {
    throw new GoogleApiError('Form ini tidak memiliki soal bernilai, jadi skor tidak bisa dihitung.', 422);
  }

  const terbaru = new Map<string, JawabanForm>();
  const tanpaNis: JawabanForm[] = [];
  let pageToken = '';

  do {
    const url = `${FORMS_API}/${formId}/responses${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const data = await googleFetch(url, accessToken);

    for (const r of data?.responses ?? []) {
      if (typeof r.totalScore !== 'number') continue;
      const teks = (id: string): string => r.answers?.[id]?.textAnswers?.answers?.[0]?.value?.trim() ?? '';
      const item: JawabanForm = {
        nama: idNama ? teks(idNama) : '',
        nis: idNis ? teks(idNis) : '',
        skor: Math.round((r.totalScore / skorMaks) * 1000) / 10,
        waktu: r.lastSubmittedTime ?? r.createTime ?? '',
      };

      if (!item.nis) {
        tanpaNis.push(item);
        continue;
      }
      const lama = terbaru.get(item.nis);
      if (!lama || item.waktu > lama.waktu) terbaru.set(item.nis, item);
    }
    pageToken = data?.nextPageToken ?? '';
  } while (pageToken);

  return { jawaban: [...terbaru.values(), ...tanpaNis], adaIdentitas: Boolean(idNama && idNis) };
}


// Menambahkan isian Nama/NIS di awal form yang sudah ada (mis. form buatan sebelum fitur impor nilai).
// Jawaban lama tetap tanpa identitas; hanya jawaban yang masuk setelahnya yang terisi.
export async function tambahIdentitasForm(formId: string, accessToken: string): Promise<{ ditambahkan: string[] }> {
  const form = await googleFetch(`${FORMS_API}/${formId}`, accessToken);
  const ada = new Set<string>((form.items ?? []).map((i: any) => i.title));
  const perlu = [JUDUL_NAMA, JUDUL_NIS].filter((j) => !ada.has(j));

  if (perlu.length > 0) {
    await googleFetch(`${FORMS_API}/${formId}:batchUpdate`, accessToken, {
      includeFormInResponse: false,
      requests: buatItemIdentitas(perlu),
    });
  }
  return { ditambahkan: perlu };
}
