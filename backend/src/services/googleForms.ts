import { HttpError } from '../lib/http';
import { latexToText } from '../utils/latexToText';

// Integrasi Google Forms API. Dipanggil dengan access token milik guru (didapat di frontend lewat
// Google Identity Services), sehingga form dibuat di Google Drive guru sendiri. Token TIDAK disimpan.

const FORMS = 'https://forms.googleapis.com/v1/forms';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';

export const JUDUL_SISWA = 'Pilih nama kamu';

async function google(url: string, token: string, body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const teks = await res.text();
  let data: any = null;
  try {
    data = teks ? JSON.parse(teks) : null;
  } catch {
    /* bukan JSON */
  }
  if (res.ok) return data;

  const pesan: string = data?.error?.message ?? teks.slice(0, 200);
  if (res.status === 401) throw new HttpError(401, 'Sesi Google habis. Hubungkan akun Google lagi.');
  if (res.status === 403) {
    throw new HttpError(403, `Akses ditolak Google. Pastikan Google Forms API aktif dan semua izin dicentang. (${pesan})`);
  }
  if (res.status === 404) throw new HttpError(404, 'Form tidak ditemukan di Google Drive Anda. Mungkin sudah dihapus atau dibuat dengan akun Google lain.');
  throw new HttpError(502, `Google Forms: ${pesan}`);
}

export interface ButirForm {
  id: string;
  pertanyaan: string;
  pilihan: string[];
  kunci: number;
  pembahasan: string;
}

// Pilihan Google Forms harus unik; teks hasil konversi LaTeX bisa kembar atau kosong.
function pilihanUnik(pilihan: string[], kunci: number): { daftar: string[]; benar: string } | null {
  const dipakai = new Set<string>();
  const daftar: string[] = [];
  let benar = '';
  pilihan.forEach((teks, i) => {
    if (!teks) return;
    let nilai = teks;
    for (let n = 2; dipakai.has(nilai); n++) nilai = `${teks} (${n})`;
    dipakai.add(nilai);
    daftar.push(nilai);
    if (i === kunci) benar = nilai;
  });
  return daftar.length >= 2 && benar ? { daftar, benar } : null;
}

const pertanyaanSiswa = (labels: string[]) => ({
  required: true,
  choiceQuestion: { type: 'DROP_DOWN', options: labels.map((value) => ({ value })) },
});

export interface HasilBuatForm {
  formId: string;
  responderUri: string;
  editUrl: string;
  siswaQid: string;
  butirQid: Record<string, string>; // id butir -> id pertanyaan di Google Form
  jumlahSoal: number;
  dilewati: number;
  bisaDiisiSiapaSaja: boolean;
}

// Pertanyaan pertama form adalah dropdown daftar nama siswa, sehingga siswa cukup memilih namanya
export async function buatKuis(
  meta: { judul: string; mapel: string; kelas: string },
  butir: ButirForm[],
  labelSiswa: string[],
  token: string
): Promise<HasilBuatForm> {
  const item = (title: string, question: object, index: number) => ({
    createItem: { item: { title, questionItem: { question } }, location: { index } },
  });

  const items: unknown[] = [item(JUDUL_SISWA, pertanyaanSiswa(labelSiswa), 0)];
  const dipakai: ButirForm[] = [];

  for (const b of butir) {
    const opsi = pilihanUnik(b.pilihan.map((p) => latexToText(p)), b.kunci);
    const tanya = latexToText(b.pertanyaan);
    if (!opsi || !tanya) continue;
    const bahas = latexToText(b.pembahasan);
    items.push(
      item(
        tanya,
        {
          required: true,
          grading: {
            pointValue: 1,
            correctAnswers: { answers: [{ value: opsi.benar }] },
            whenRight: { text: bahas ? `Benar!\n\n${bahas}` : 'Benar!' },
            whenWrong: { text: `Jawaban yang benar: ${opsi.benar}${bahas ? `\n\n${bahas}` : ''}` },
          },
          choiceQuestion: { type: 'RADIO', options: opsi.daftar.map((value) => ({ value })) },
        },
        items.length
      )
    );
    dipakai.push(b);
  }
  if (dipakai.length === 0) throw new HttpError(422, 'Tidak ada soal yang valid untuk dimasukkan ke Google Form.');

  const form = await google(FORMS, token, { info: { title: meta.judul, documentTitle: meta.judul } });
  const formId: string = form.formId;
  const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

  try {
    await google(`${FORMS}/${formId}:batchUpdate`, token, {
      requests: [
        { updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: 'quizSettings.isQuiz' } },
        {
          updateFormInfo: {
            info: { description: `${meta.mapel} · Kelas ${meta.kelas}\n\nPilih namamu dari daftar, lalu jawab semua soal. Isi sekali saja.` },
            updateMask: 'description',
          },
        },
        ...items,
      ],
    });
    await google(`${FORMS}/${formId}:setPublishSettings`, token, {
      publishSettings: { publishState: { isPublished: true, isAcceptingResponses: true } },
    });
  } catch (err) {
    const e = err as HttpError;
    throw new HttpError(
      e.status ?? 502,
      `${e.message} (Form sebagian sudah terbuat di Google Drive Anda dan boleh dihapus: ${editUrl})`
    );
  }

  // Ambil id pertanyaan yang dibuat Google: urutannya sama dengan urutan item di atas.
  const hasil = await google(`${FORMS}/${formId}`, token);
  const qids: string[] = (hasil.items ?? [])
    .map((i: any) => i.questionItem?.question?.questionId)
    .filter((q: unknown): q is string => typeof q === 'string');
  if (qids.length !== dipakai.length + 1) {
    throw new HttpError(502, `Struktur form tidak sesuai harapan. Periksa form di: ${editUrl}`);
  }

  // Opsional: izinkan siapa saja yang punya link mengisi (butuh scope drive.file).
  let bisaDiisiSiapaSaja = false;
  try {
    await google(`${DRIVE}/${formId}/permissions`, token, { type: 'anyone', view: 'published', role: 'reader' });
    bisaDiisiSiapaSaja = true;
  } catch {
    /* guru mengatur akses sendiri lewat tombol Kirim */
  }

  return {
    formId,
    responderUri: form.responderUri ?? `https://docs.google.com/forms/d/${formId}/viewform`,
    editUrl,
    siswaQid: qids[0],
    butirQid: Object.fromEntries(dipakai.map((b, i) => [b.id, qids[i + 1]])),
    jumlahSoal: dipakai.length,
    dilewati: butir.length - dipakai.length,
    bisaDiisiSiapaSaja,
  };
}

// Mengganti isi dropdown nama di form yang sudah ada (mis. setelah ada siswa baru di kelas).
export async function perbaruiDaftarSiswa(formId: string, siswaQid: string, labelSiswa: string[], token: string) {
  const form = await google(`${FORMS}/${formId}`, token);
  const items: any[] = form.items ?? [];
  const index = items.findIndex((i) => i.questionItem?.question?.questionId === siswaQid);
  if (index < 0) throw new HttpError(409, 'Pertanyaan nama tidak ditemukan di form. Mungkin sudah dihapus atau diubah di Google Forms.');

  await google(`${FORMS}/${formId}:batchUpdate`, token, {
    requests: [
      {
        updateItem: {
          item: {
            itemId: items[index].itemId,
            title: JUDUL_SISWA,
            questionItem: { question: { questionId: siswaQid, ...pertanyaanSiswa(labelSiswa) } },
          },
          location: { index },
          updateMask: 'title,questionItem.question.required,questionItem.question.choiceQuestion',
        },
      },
    ],
  });
}

export interface JawabanForm {
  responseId: string;
  pilihan: string; // teks yang dipilih siswa di dropdown nama
  skor: number; // skala 0-100
  waktu: string;
  benar: Record<string, boolean>; // id pertanyaan -> benar/salah
}

// Membaca jawaban siswa dan mengubah skornya ke skala 0-100.
// Satu siswa (pilihan nama sama) yang mengisi berkali-kali hanya dihitung jawaban terbarunya.
export async function ambilJawaban(
  formId: string,
  siswaQid: string,
  jumlahSoal: number,
  token: string
): Promise<{ jawaban: JawabanForm[]; tanpaNama: number }> {
  if (jumlahSoal <= 0) throw new HttpError(422, 'Set soal ini tidak memiliki soal bernilai.');

  const terbaru = new Map<string, JawabanForm>();
  let tanpaNama = 0;
  let halaman = '';

  do {
    const data = await google(`${FORMS}/${formId}/responses${halaman ? `?pageToken=${encodeURIComponent(halaman)}` : ''}`, token);
    for (const r of data?.responses ?? []) {
      if (typeof r.totalScore !== 'number') continue;
      const pilihan: string = r.answers?.[siswaQid]?.textAnswers?.answers?.[0]?.value?.trim() ?? '';
      if (!pilihan) {
        tanpaNama++;
        continue;
      }
      const benar: Record<string, boolean> = {};
      for (const [id, jawab] of Object.entries<any>(r.answers ?? {})) {
        if (jawab?.grade) benar[id] = Boolean(jawab.grade.correct ?? jawab.grade.score > 0);
      }
      const j: JawabanForm = {
        responseId: r.responseId,
        pilihan,
        skor: Math.round((r.totalScore / jumlahSoal) * 1000) / 10,
        waktu: r.lastSubmittedTime ?? r.createTime ?? '',
        benar,
      };
      const lama = terbaru.get(pilihan);
      if (!lama || j.waktu > lama.waktu) terbaru.set(pilihan, j);
    }
    halaman = data?.nextPageToken ?? '';
  } while (halaman);

  return { jawaban: [...terbaru.values()], tanpaNama };
}
