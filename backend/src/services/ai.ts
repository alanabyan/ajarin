import { z } from 'zod';
import { HttpError } from '../lib/http';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Rumus matematika ditulis dengan delimiter dolar supaya bisa dirender KaTeX di frontend.
const ATURAN_RUMUS =
  'Tulis rumus atau notasi matematika dalam LaTeX dan WAJIB dibungkus tanda dolar: $...$ untuk sebaris, $$...$$ untuk persamaan tersendiri. ' +
  'Jangan menulis LaTeX tanpa tanda dolar.';

async function kirimGroq(body: object, signal: AbortSignal): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new HttpError(500, 'GROQ_API_KEY belum diatur di server.');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL(), temperature: 0.6, ...body }),
  });
  if (!res.ok) {
    console.error('Groq error:', res.status, (await res.text()).slice(0, 300));
    throw new HttpError(502, 'Layanan AI sedang bermasalah. Coba lagi sebentar.');
  }
  return res;
}

const pesan = (system: string, user: string) => [
  { role: 'system', content: system },
  { role: 'user', content: user },
];

// Mengubah galat jaringan / timeout menjadi HttpError yang ramah.
function galatAI(err: unknown): never {
  if (err instanceof HttpError) throw err;
  if ((err as Error).name === 'AbortError') throw new HttpError(504, 'AI terlalu lama merespons. Coba lagi.');
  throw new HttpError(502, 'Tidak dapat menghubungi layanan AI.');
}

interface OpsiAI {
  waktu?: number;
  maxToken?: number;
  suhu?: number;
}

async function panggilGroq(system: string, user: string, json = false, opsi: OpsiAI = {}): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opsi.waktu ?? 55_000);
  try {
    const res = await kirimGroq(
      {
        messages: pesan(system, user),
        max_completion_tokens: opsi.maxToken ?? 6000,
        ...(opsi.suhu !== undefined ? { temperature: opsi.suhu } : {}),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      },
      ctrl.signal
    );
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const teks = data.choices?.[0]?.message?.content?.trim();
    if (!teks) throw new HttpError(502, 'AI tidak mengembalikan jawaban. Coba lagi.');
    return teks;
  } catch (err) {
    return galatAI(err);
  } finally {
    clearTimeout(timer);
  }
}

/** Satu baris aliran SSE Groq ("data: {...}") -> potongan teks. Baris lain, "[DONE]", atau JSON rusak -> ''. */
export function teksDariBarisSse(baris: string): string {
  const b = baris.trim();
  if (!b.startsWith('data:')) return '';
  const isi = b.slice(5).trim();
  if (!isi || isi === '[DONE]') return '';
  try {
    const d = JSON.parse(isi) as { choices?: { delta?: { content?: string | null } }[] };
    return d.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

/**
 * Jawaban AI sebagai aliran potongan teks. Permintaan ke Groq dikirim dulu, jadi galat awal dilempar sebelum
 * pemanggil mulai menulis respons. `signal` menghentikan aliran bila klien memutus koneksi.
 */
export async function alirGroq(system: string, user: string, signal: AbortSignal): Promise<AsyncGenerator<string>> {
  const ctrl = new AbortController();
  let habisWaktu = false;
  const timer = setTimeout(() => {
    habisWaktu = true;
    ctrl.abort();
  }, 55_000);
  const putus = () => ctrl.abort();
  if (signal.aborted) putus();
  else signal.addEventListener('abort', putus, { once: true });
  const bersih = () => {
    clearTimeout(timer);
    signal.removeEventListener('abort', putus);
  };

  let res: Response;
  try {
    res = await kirimGroq({ messages: pesan(system, user), max_completion_tokens: 6000, stream: true }, ctrl.signal);
  } catch (err) {
    bersih();
    return galatAI(err);
  }
  if (!res.body) {
    bersih();
    throw new HttpError(502, 'AI tidak mengembalikan jawaban. Coba lagi.');
  }

  const reader = res.body.getReader();
  async function* baca() {
    const dekoder = new TextDecoder();
    let sisa = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        sisa += dekoder.decode(value, { stream: true });
        const baris = sisa.split('\n');
        sisa = baris.pop() ?? '';
        for (const b of baris) {
          const t = teksDariBarisSse(b);
          if (t) yield t;
        }
      }
      const t = teksDariBarisSse(sisa);
      if (t) yield t;
    } catch (err) {
      if (habisWaktu) throw new HttpError(504, 'AI terlalu lama merespons. Coba lagi.');
      throw err;
    } finally {
      bersih();
      reader.cancel().catch(() => {});
    }
  }
  return baca();
}

export interface InputModul {
  topik: string;
  mapel: string;
  jenjang: string;
  kelas: string;
  tujuanPembelajaran: string;
  alokasiWaktu: string;
  kondisiKelas?: string;
}

function promptModul(i: InputModul): { system: string; user: string } {
  const system =
    'Kamu penyusun modul ajar untuk guru di Indonesia berdasarkan Kurikulum Merdeka. Tulis modul yang praktis, ' +
    'konkret, dan siap dipakai, dengan bahasa Indonesia baku yang mudah dipahami. Balas hanya dengan isi modul dalam Markdown. ' +
    ATURAN_RUMUS;
  const user = `Susun modul ajar:
- Mata pelajaran: ${i.mapel}
- Jenjang / kelas: ${i.jenjang} / ${i.kelas}
- Topik: ${i.topik}
- Alokasi waktu: ${i.alokasiWaktu}
- Tujuan pembelajaran: ${i.tujuanPembelajaran}
- Kondisi kelas: ${i.kondisiKelas || 'Kelas standar dengan fasilitas terbatas'}

Bagian wajib (gunakan heading ##): Identitas Modul, Tujuan Pembelajaran, Pemahaman Bermakna, Kegiatan Pendahuluan, Kegiatan Inti (dengan perkiraan menit tiap tahap), Kegiatan Penutup, Asesmen dan Rubrik, Diferensiasi (siswa butuh bantuan dan siswa mahir), Refleksi Guru.`;
  return { system, user };
}

export function buatModul(i: InputModul): Promise<string> {
  const { system, user } = promptModul(i);
  return panggilGroq(system, user);
}

/** Versi streaming dari buatModul: teks modul tiba bertahap. */
export function alirModul(i: InputModul, signal: AbortSignal): Promise<AsyncGenerator<string>> {
  const { system, user } = promptModul(i);
  return alirGroq(system, user, signal);
}

export interface InputSoal {
  mapel: string;
  jenjang: string;
  kelas: string;
  materi: string;
  tingkat: string;
  jumlah: number;
  /** Soal yang banyak dijawab salah siswa; bila ada, soal dibuat sebagai latihan remedial untuk konsep yang sama. */
  soalLemah?: string[];
}

const butirSchema = z
  .object({
    pertanyaan: z.string().trim().min(5),
    pilihan: z.array(z.string().trim().min(1)).length(4),
    kunciIndex: z.number().int().min(0).max(3),
    pembahasan: z.string().trim().min(1),
  })
  .refine((b) => new Set(b.pilihan).size === 4, { message: 'pilihan harus berbeda satu sama lain' });

type ButirMentah = z.infer<typeof butirSchema>;

export type ButirAI = ButirMentah & {
  /** Hasil verifikasi ulang AI berbeda dari kunci; guru perlu memeriksa soal ini. */
  ragu: boolean;
};

const HURUF = ['A', 'B', 'C', 'D'];

/**
 * Pass kedua: AI mengerjakan soal tanpa melihat kunci. Soal yang jawabannya berbeda dari kunci ditandai
 * `ragu`. Bisa kuncinya yang salah, bisa juga verifikatornya yang keliru, jadi ini hanya penanda untuk guru.
 * Verifikasi bersifat tambahan: bila gagal, soal tetap dipakai dan tidak ditandai.
 */
export async function tandaiKunciRagu(butir: ButirMentah[]): Promise<boolean[]> {
  const aman = butir.map(() => false);
  if (butir.length === 0) return aman;
  const system =
    'Kamu penguji soal pilihan ganda. Kerjakan setiap soal sendiri secara teliti, hitung langkah demi langkah bila perlu, ' +
    'lalu pilih satu jawaban. Balas HANYA dengan satu objek JSON valid, tanpa teks lain.';
  const daftar = butir
    .map((b, n) => `${n + 1}. ${b.pertanyaan}\n${b.pilihan.map((p, i) => `   ${HURUF[i]}. ${p}`).join('\n')}`)
    .join('\n\n');
  const user = `Kerjakan soal berikut.\n\n${daftar}\n\nFormat: {"hasil":[{"no":1,"langkah":"ringkasan perhitungan singkat","jawaban":"A"}]}. Satu entri untuk setiap nomor.`;
  try {
    const mentah = await panggilGroq(system, user, true, { waktu: 25_000, maxToken: 4000, suhu: 0.1 });
    const hasil = (JSON.parse(mentah) as { hasil?: { no?: unknown; jawaban?: unknown }[] }).hasil;
    if (!Array.isArray(hasil)) return aman;
    return butir.map((b, n) => {
      const ada = hasil.find((h) => Number(h?.no) === n + 1);
      const idx = typeof ada?.jawaban === 'string' ? HURUF.indexOf(ada.jawaban.trim().charAt(0).toUpperCase()) : -1;
      return idx >= 0 && idx !== b.kunciIndex;
    });
  } catch (err) {
    console.error('Verifikasi kunci dilewati:', (err as Error).message);
    return aman;
  }
}

export async function buatSoal(i: InputSoal): Promise<ButirAI[]> {
  const system =
    'Kamu pembuat soal untuk guru di Indonesia. Balas HANYA dengan satu objek JSON valid, tanpa teks lain. ' + ATURAN_RUMUS;
  const daftarLemah = (i.soalLemah ?? []).map((q, n) => `${n + 1}. ${q}`).join('\n');
  const remedial = i.soalLemah?.length
    ? '\nINI SOAL REMEDIAL. Banyak siswa menjawab salah soal-soal berikut:\n' +
      daftarLemah +
      '\nBuat soal BARU yang melatih konsep yang sama tetapi dengan angka, konteks, dan susunan kalimat yang berbeda (jangan menyalin soal di atas). ' +
      'Urutkan dari yang paling mudah ke sedang, dan buat pembahasan menjelaskan langkah penyelesaian secara runtut agar siswa memahami letak kesalahannya.\n'
    : '';
  const user = `Buat ${i.jumlah} soal pilihan ganda ${i.mapel} untuk ${i.jenjang} kelas ${i.kelas}, materi "${i.materi}", tingkat kesulitan ${i.tingkat}.${remedial}
Aturan: tepat 4 pilihan jawaban yang berbeda dan masuk akal, hanya satu yang benar, kunci acak di antara A-D, pembahasan singkat dan benar.
Format: {"soal":[{"pertanyaan":"...","pilihan":["...","...","...","..."],"kunciIndex":0,"pembahasan":"..."}]}
kunciIndex adalah indeks (0-3) jawaban benar pada array pilihan.`;

  const mentah = await panggilGroq(system, user, true);
  let parsed: unknown;
  try {
    parsed = JSON.parse(mentah);
  } catch {
    throw new HttpError(502, 'Format jawaban AI tidak terbaca. Coba lagi.');
  }
  const daftar = (parsed as { soal?: unknown[] })?.soal;
  if (!Array.isArray(daftar)) throw new HttpError(502, 'Format jawaban AI tidak sesuai. Coba lagi.');

  // Item rusak dibuang satu per satu supaya satu soal cacat tidak menggagalkan seluruh set.
  const valid = daftar.flatMap((d) => {
    const r = butirSchema.safeParse(d);
    return r.success ? [r.data] : [];
  });
  if (valid.length === 0) throw new HttpError(502, 'AI tidak menghasilkan soal yang valid. Coba lagi.');
  const dipakai = valid.slice(0, i.jumlah);
  const ragu = await tandaiKunciRagu(dipakai);
  return dipakai.map((b, n) => ({ ...b, ragu: ragu[n] }));
}
