import { z } from 'zod';
import { HttpError } from '../lib/http';
import { fase, type MasalahIsian } from '../utils/akademik';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Rumus matematika ditulis dengan delimiter dolar supaya bisa dirender KaTeX di frontend.
const ATURAN_RUMUS =
  'Tulis rumus atau notasi matematika dalam LaTeX dan WAJIB dibungkus tanda dolar: $...$ untuk sebaris, $$...$$ untuk persamaan tersendiri. ' +
  'Jangan menulis LaTeX tanpa tanda dolar, dan jangan memakai penanda \\( \\) atau \\[ \\].';

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
export async function alirGroq(system: string, user: string, signal: AbortSignal, maxToken = 6000): Promise<AsyncGenerator<string>> {
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
    res = await kirimGroq({ messages: pesan(system, user), max_completion_tokens: maxToken, stream: true }, ctrl.signal);
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
  judul: string;
  topik: string;
  mapel: string;
  jenjang: string;
  kelas: string;
  semester: string;
  jumlahPertemuan: number;
  /** mis. "2 JP × 40 menit" per pertemuan */
  alokasiWaktu: string;
  tujuanPembelajaran: string;
  kondisiKelas?: string;
  namaGuru?: string;
  sekolah?: string | null;
}

// Modul ajar berformat rencana semester (seperti RPS): satu dokumen untuk satu semester, dengan tabel
// rencana per pertemuan. Bukan rencana satu pertemuan (pendahuluan / inti / penutup).
function promptModul(i: InputModul): { system: string; user: string } {
  const f = fase(i.kelas);
  const system =
    'Kamu penyusun perangkat ajar untuk guru di Indonesia berdasarkan Kurikulum Merdeka. Kamu menyusun modul ajar ' +
    'dalam format rencana pembelajaran semester (seperti RPS): satu dokumen mencakup seluruh semester dan berisi tabel ' +
    'rencana per pertemuan. JANGAN menulis rencana satu pertemuan dengan kegiatan pendahuluan, inti, dan penutup. ' +
    'Gunakan bahasa Indonesia baku yang ringkas. Balas hanya dengan isi dokumen dalam Markdown (tabel memakai sintaks tabel Markdown). ' +
    ATURAN_RUMUS;
  const user = `Susun modul ajar format rencana semester:
- Judul: ${i.judul}
- Mata pelajaran: ${i.mapel}
- Jenjang / kelas / fase: ${i.jenjang} / ${i.kelas}${f ? ` / Fase ${f}` : ''}
- Semester: ${i.semester}
- Jumlah pertemuan: ${i.jumlahPertemuan}
- Alokasi waktu tiap pertemuan: ${i.alokasiWaktu}
- Cakupan materi: ${i.topik}
- Tujuan pembelajaran dari guru: ${i.tujuanPembelajaran}
- Kondisi kelas: ${i.kondisiKelas || 'Kelas standar dengan fasilitas terbatas'}
${i.namaGuru ? `- Guru pengampu: ${i.namaGuru}
` : ''}${i.sekolah ? `- Sekolah: ${i.sekolah}
` : ''}
Susunan wajib (heading ##, urut):
1. ## Identitas — daftar: sekolah, mata pelajaran, jenjang/kelas/fase, semester, jumlah pertemuan, alokasi waktu, guru pengampu (tulis "-" bila tidak ada).
2. ## Deskripsi Singkat — satu paragraf tentang isi dan arah pembelajaran semester ini.
3. ## Capaian Pembelajaran (CP) — CP Kurikulum Merdeka fase ${f || 'terkait'} untuk mapel ini, ringkas.
4. ## Tujuan Pembelajaran (TP) — daftar bernomor TP-1, TP-2, dst. Turunkan dari tujuan guru di atas; boleh dirinci, jangan mengganti maknanya.
5. ## Rencana Pembelajaran per Pertemuan — SATU tabel dengan tepat ${i.jumlahPertemuan} baris isi (satu baris per pertemuan, urut 1 sampai ${i.jumlahPertemuan}) dan kolom:
   | Pertemuan ke- | TP | Indikator Ketercapaian | Materi Pokok | Metode & Bentuk Pembelajaran (estimasi waktu) | Kriteria & Bentuk Penilaian | Bobot (%) |
   Kolom TP berisi kode TP (mis. TP-1). Sisipkan Asesmen Tengah Semester di sekitar pertengahan dan Asesmen Akhir Semester di pertemuan terakhir. Total kolom Bobot = 100.
   PENTING: isi SEMUA sel tabel dengan kata-kata biasa, TANPA rumus atau notasi LaTeX (tulis "rumus distribusi Poisson", bukan rumusnya). Kolom Materi Pokok berupa nama materi singkat.
6. ## Komposisi Penilaian — tabel | Komponen | Bobot (%) | (formatif, sumatif tengah semester, sumatif akhir semester, dll.), total 100, konsisten dengan tabel pertemuan.
7. ## Sumber Belajar — daftar buku teks/sumber yang relevan dan mudah didapat.
Jangan tambahkan bagian lain dan jangan menulis pembuka atau penutup di luar dokumen.`;
  return { system, user };
}

export function buatModul(i: InputModul): Promise<string> {
  const { system, user } = promptModul(i);
  return panggilGroq(system, user, false, { maxToken: 8000 });
}

/** Versi streaming dari buatModul: teks modul tiba bertahap. */
export function alirModul(i: InputModul, signal: AbortSignal): Promise<AsyncGenerator<string>> {
  const { system, user } = promptModul(i);
  return alirGroq(system, user, signal, 8000);
}

export interface InputSaranModul {
  mapel: string;
  jenjang: string;
  kelas: string;
  semester: string;
  jumlahPertemuan: number;
  /** Materi yang sudah diketik guru (opsional); bila ada, TP disusun dari materi ini. */
  topik?: string;
}

const saranSchema = z.object({
  materi: z.array(z.string().trim().min(2)).min(1),
  tujuan: z.array(z.string().trim().min(10)).min(1),
});

/**
 * Saran isian modul: cakupan materi semester dan tujuan pembelajaran sesuai CP fase kelas tersebut.
 * Hanya bahan isian formulir yang masih bisa disunting guru; tidak disimpan dan tidak memakai kuota harian.
 */
export async function saranModul(i: InputSaranModul): Promise<{ topik: string; tujuanPembelajaran: string }> {
  const f = fase(i.kelas);
  const system =
    'Kamu penyusun kurikulum Kurikulum Merdeka di Indonesia. Kamu memahami Capaian Pembelajaran (CP) tiap fase dan ' +
    'urutan materi di buku teks Kemendikbudristek. Balas HANYA dengan satu objek JSON valid.';
  const user = `Sarankan isian modul ajar satu semester:
- Mata pelajaran: ${i.mapel}
- Jenjang / kelas / fase: ${i.jenjang} / ${i.kelas}${f ? ` / Fase ${f}` : ''}
- Semester: ${i.semester}
- Jumlah pertemuan: ${i.jumlahPertemuan}
${i.topik ? `- Materi yang sudah ditentukan guru (WAJIB dipakai, boleh dirapikan): ${i.topik}
` : ''}
Buat:
1. "materi": 4-8 materi pokok yang lazim diajarkan di semester ${i.semester.toLowerCase()} kelas tersebut, urut sesuai urutan pembelajaran, masing-masing frasa singkat (maks. 6 kata), dan cukup untuk ${i.jumlahPertemuan} pertemuan.
2. "tujuan": 4-8 tujuan pembelajaran yang diturunkan dari CP fase ${f || 'terkait'} dan mencakup materi di atas, masing-masing satu kalimat diawali "Peserta didik mampu", memakai kata kerja operasional yang terukur.
Format: {"materi":["..."],"tujuan":["..."]}`;

  const mentah = await panggilGroq(system, user, true, { waktu: 30_000, maxToken: 1500, suhu: 0.4 });
  let hasil: z.infer<typeof saranSchema>;
  try {
    hasil = saranSchema.parse(JSON.parse(mentah));
  } catch {
    throw new HttpError(502, 'Saran AI tidak terbaca. Coba lagi.');
  }
  // Dipotong agar tetap lolos batas panjang isian formulir (cakupan materi 300, TP 2000 karakter).
  let topik = '';
  for (const m of hasil.materi) {
    const lanjut = topik ? `${topik}, ${m}` : m;
    if (lanjut.length > 300) break;
    topik = lanjut;
  }
  const tujuanPembelajaran = hasil.tujuan.slice(0, 8).join('\n').slice(0, 2000);
  return { topik, tujuanPembelajaran };
}

export interface InputKonsistensi {
  jenis: 'modul' | 'soal';
  jenjang: string;
  kelas: string;
  mapel: string;
  /** Kolom teks bebas yang diperiksa, kunci = nama kolom formulir, mis. { judul, topik, tujuanPembelajaran }. */
  kolom: Record<string, string>;
  /** Label kolom untuk pesan, mis. { topik: 'Cakupan materi' }. */
  label: Record<string, string>;
}

/**
 * Pemeriksaan AI sebelum membuat dokumen: apakah judul, materi, dan TP sesuai mata pelajaran, cocok untuk
 * jenjang/kelas yang dipilih, dan saling nyambung. Hanya ketidaksesuaian yang jelas yang dilaporkan.
 * Bersifat tambahan: bila AI gagal, dianggap tidak ada masalah supaya guru tidak terhalang.
 */
export async function periksaKonsistensi(i: InputKonsistensi): Promise<MasalahIsian[]> {
  const bagianSah = new Set([...Object.keys(i.kolom), 'mapel', 'kelas']);
  const label = { ...i.label, mapel: 'Mata pelajaran', kelas: 'Kelas' } as Record<string, string>;
  const f = fase(i.kelas);
  const daftar = Object.entries(i.kolom)
    .map(([k, v]) => `- ${k} (${label[k] ?? k}): ${v}`)
    .join('\n');
  const system =
    'Kamu pemeriksa isian formulir perangkat ajar guru di Indonesia (Kurikulum Merdeka). Tugasmu hanya menemukan ' +
    'ketidaksesuaian yang JELAS; jangan mempersoalkan gaya bahasa, ejaan kecil, atau isian yang masih masuk akal. ' +
    'Balas HANYA dengan satu objek JSON valid.';
  const user = `Periksa isian ${i.jenis === 'modul' ? 'modul ajar' : 'set soal'} berikut.
- mapel (Mata pelajaran): ${i.mapel}
- kelas (Kelas): ${i.jenjang} kelas ${i.kelas}${f ? ` (Fase ${f})` : ''}
${daftar}

Laporkan masalah hanya bila:
1. Isian tidak berhubungan dengan mata pelajaran (mis. materi "fotosintesis" untuk mapel Matematika).
2. Materi jelas tidak sesuai tingkat kelas (mis. "turunan fungsi" untuk SD kelas II, atau "penjumlahan 1-10" untuk SMA kelas XI).
3. Judul, materi, dan tujuan pembelajaran saling bertentangan atau membahas hal yang berbeda.
4. Isian tidak bermakna (asal ketik, mis. "asdf", "tes tes").
Untuk setiap masalah, isi "bagian" dengan nama kolom yang perlu diperbaiki (salah satu dari: ${[...bagianSah].join(', ')}) dan "pesan" berupa penjelasan singkat dalam bahasa Indonesia beserta saran perbaikan.
Format: {"masalah":[{"bagian":"judul","pesan":"..."}]}. Bila semuanya sesuai: {"masalah":[]}.`;
  try {
    const mentah = await panggilGroq(system, user, true, { waktu: 20_000, maxToken: 800, suhu: 0.1 });
    const hasil = (JSON.parse(mentah) as { masalah?: unknown }).masalah;
    if (!Array.isArray(hasil)) return [];
    return hasil.flatMap((m) => {
      const bagian = typeof m?.bagian === 'string' ? m.bagian.trim() : '';
      const pesan = typeof m?.pesan === 'string' ? m.pesan.trim().slice(0, 300) : '';
      return bagianSah.has(bagian) && pesan ? [{ bagian, pesan }] : [];
    });
  } catch (err) {
    console.error('Pemeriksaan konsistensi dilewati:', (err as Error).message);
    return [];
  }
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
