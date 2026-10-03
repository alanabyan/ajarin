import { z } from 'zod';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

interface GroqResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
}

// Instruksi format matematika: dipakai di prompt modul ajar maupun bank soal,
// supaya rumus konsisten dibungkus dengan delimiter yang bisa dirender KaTeX di frontend.
const INSTRUKSI_LATEX =
  'Jika ada rumus, persamaan, atau notasi matematika, tulis dalam format LaTeX dan WAJIB bungkus dengan tanda dolar: ' +
  'gunakan $...$ untuk notasi sebaris (contoh: $x^2 + 1$) dan $$...$$ untuk persamaan yang berdiri sendiri. ' +
  'Jangan menulis kode LaTeX mentah tanpa tanda dolar, karena tidak akan bisa dirender.';

async function callGroq(system: string, userPrompt: string, jsonMode = false): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('GROQ_API_KEY belum diatur di file .env'), { status: 500 });
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_completion_tokens: 6000,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Gagal memanggil AI: ${text}`), { status: 502 });
  }

  const data = (await response.json()) as GroqResponse;
  const text = data.choices?.[0]?.message?.content ?? '';

  if (!text) {
    const reason = data.choices?.[0]?.finish_reason ?? 'tidak diketahui';
    throw Object.assign(new Error(`AI tidak mengembalikan teks (finish_reason: ${reason}).`), {
      status: 502,
    });
  }

  return text;
}

interface GenerateModulAjarInput {
  topik: string;
  jenjang: string;
  kelas: string;
  tujuanPembelajaran: string;
  alokasiWaktu: string;
  kondisiKelas?: string;
}

export async function generateModulAjar(input: GenerateModulAjarInput): Promise<string> {
  const system =
    'Kamu adalah asisten penyusun modul ajar untuk guru di Indonesia yang mengikuti struktur Kurikulum Merdeka. ' +
    'Tulis modul ajar yang praktis, jelas, dan siap pakai. Sesuaikan kegiatan dengan kondisi kelas yang disebutkan. ' +
    'Gunakan bahasa Indonesia yang baku namun mudah dipahami. Jangan menyertakan komentar di luar isi modul. ' +
    INSTRUKSI_LATEX;

  const userPrompt = `Buatkan draf modul ajar dengan detail berikut:
- Jenjang: ${input.jenjang}
- Kelas: ${input.kelas}
- Topik: ${input.topik}
- Alokasi waktu: ${input.alokasiWaktu}
- Tujuan pembelajaran: ${input.tujuanPembelajaran}
- Kondisi kelas: ${input.kondisiKelas || 'Kelas standar, fasilitas terbatas'}

Susun modul dengan bagian berikut: (1) Identitas, (2) Tujuan Pembelajaran, (3) Kegiatan Pendahuluan, (4) Kegiatan Inti, (5) Kegiatan Penutup, (6) Asesmen dan rubrik singkat, (7) Diferensiasi untuk siswa dengan kemampuan berbeda, (8) Refleksi guru. Format dalam Markdown dengan heading yang jelas.`;

  return callGroq(system, userPrompt);
}

interface GenerateSoalInput {
  mapel: string;
  materi: string;
  tingkatKesulitan: string;
  jumlahSoal: number;
}

// Validasi ketat: AI kadang menghasilkan item rusak yang tetap lolos JSON.parse.
const soalSchema = z
  .object({
    pertanyaan: z.string().min(5),
    pilihanJawaban: z.array(z.string().min(1)).length(4),
    kunciJawaban: z.string().min(1),
    pembahasan: z.string().min(1),
  })
  .refine((s) => s.pilihanJawaban.includes(s.kunciJawaban), {
    message: 'kunciJawaban harus sama persis dengan salah satu pilihanJawaban',
  });

export interface GeneratedSoal {
  pertanyaan: string;
  pilihanJawaban?: string[];
  kunciJawaban: string;
  pembahasan: string;
}

export async function generateBankSoal(input: GenerateSoalInput): Promise<GeneratedSoal[]> {
  // Mode JSON Groq menghasilkan sebuah objek JSON, jadi array dibungkus dalam properti "soal".
  const system =
    'Kamu adalah asisten pembuat soal untuk guru di Indonesia. Selalu balas HANYA dengan JSON yang valid, tanpa teks lain, tanpa markdown code fence. ' +
    INSTRUKSI_LATEX;

  const userPrompt = `Buatkan ${input.jumlahSoal} soal pilihan ganda untuk mata pelajaran ${input.mapel}, materi "${input.materi}", tingkat kesulitan ${input.tingkatKesulitan}.
Balas dalam format JSON berikut:
{"soal": [{"pertanyaan": string, "pilihanJawaban": [string, string, string, string], "kunciJawaban": string, "pembahasan": string}]}`;

  const MAX_PERCOBAAN = 2;

  for (let i = 0; i < MAX_PERCOBAAN; i++) {
    const raw = await callGroq(system, userPrompt, true);
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      continue; // JSON tidak valid, coba lagi
    }

    const kandidat = Array.isArray(parsed) ? parsed : parsed?.soal;
    if (!Array.isArray(kandidat)) continue;

    // Buang item yang rusak, simpan hanya yang lolos validasi.
    const valid: GeneratedSoal[] = [];
    for (const item of kandidat) {
      const hasil = soalSchema.safeParse(item);
      if (hasil.success) valid.push(hasil.data);
    }

    if (valid.length > 0) return valid.slice(0, input.jumlahSoal);
  }

  throw Object.assign(new Error('AI tidak menghasilkan soal yang valid. Coba ulangi.'), {
    status: 502,
  });
}
