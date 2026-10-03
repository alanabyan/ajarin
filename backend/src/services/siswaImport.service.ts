import ExcelJS from 'exceljs';
import { z } from 'zod';

export interface SiswaImport {
  nama: string;
  nis: string;
}

export interface HasilImport {
  siswa: SiswaImport[];
  peringatan: string[];
  sumber: 'excel' | 'csv' | 'foto';
}

export const MAKS_SISWA = 200;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

export const MIME_GAMBAR = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function galat(pesan: string, status = 400): Error {
  return Object.assign(new Error(pesan), { status });
}

function adaHuruf(s: string): boolean {
  return /\p{L}/u.test(s);
}

function rapikanKapital(nama: string): string {
  const hurufBesarSemua = nama === nama.toUpperCase() && nama !== nama.toLowerCase();
  if (!hurufBesarSemua) return nama;
  return nama
    .toLowerCase()
    .replace(/(^|[\s\-'.])(\p{L})/gu, (_m, pemisah: string, huruf: string) => pemisah + huruf.toUpperCase());
}

function bersihkanNama(mentah: string): string {
  let nama = mentah
    .replace(/^\s*\d{1,3}\s*[.)\-:]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  nama = rapikanKapital(nama);
  return nama.slice(0, 100);
}

function bersihkanNis(mentah: string): string {
  return mentah.replace(/\s+/g, '').slice(0, 30);
}

function kunciSiswa(s: SiswaImport): string {
  const nis = s.nis.trim().toLowerCase();
  return nis && nis !== '-' ? `nis:${nis}` : `nama:${s.nama.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function rapikanDaftar(daftar: SiswaImport[], peringatan: string[]): SiswaImport[] {
  const dilihat = new Set<string>();
  const hasil: SiswaImport[] = [];
  let duplikat = 0;

  for (const s of daftar) {
    if (s.nama.length < 2 || !adaHuruf(s.nama)) continue;
    const k = kunciSiswa(s);
    if (dilihat.has(k)) {
      duplikat++;
      continue;
    }
    dilihat.add(k);
    hasil.push(s);
  }

  if (duplikat > 0) peringatan.push(`${duplikat} baris kembar digabung.`);
  if (hasil.length > MAKS_SISWA) {
    peringatan.push(`Hanya ${MAKS_SISWA} siswa pertama yang diambil (batas per impor).`);
    hasil.length = MAKS_SISWA;
  }
  const tanpaNis = hasil.filter((s) => !s.nis).length;
  if (tanpaNis > 0) {
    peringatan.push(`${tanpaNis} siswa tanpa NIS. Anda bisa mengisinya di pratinjau; jika dikosongkan akan disimpan sebagai "-".`);
  }
  return hasil;
}

const RE_NAMA = /^nama(\s+(siswa|lengkap|peserta\s+didik))?$/i;
const RE_NIS = /^(nis|nisn|nis\s*\/\s*nisn|no\.?\s*induk|nomor\s+induk)/i;

function ekstrakDariBaris(baris: string[][]): SiswaImport[] {
  let barisHeader = -1;
  let kolomNama = -1;
  let kolomNis = -1;

  for (let r = 0; r < Math.min(baris.length, 20); r++) {
    const n = baris[r].findIndex((c) => RE_NAMA.test(c.trim()));
    if (n >= 0) {
      barisHeader = r;
      kolomNama = n;
      kolomNis = baris[r].findIndex((c) => RE_NIS.test(c.trim()));
      break;
    }
  }

  const hasil: SiswaImport[] = [];

  if (barisHeader >= 0) {
    for (let r = barisHeader + 1; r < baris.length; r++) {
      const nama = bersihkanNama(baris[r][kolomNama] ?? '');
      if (!nama || !adaHuruf(nama) || RE_NAMA.test(nama)) continue;
      const nis = kolomNis >= 0 ? bersihkanNis(baris[r][kolomNis] ?? '') : '';
      hasil.push({ nama, nis });
    }
    return hasil;
  }

  // Tanpa header: cari sel yang berisi huruf sebagai nama, dan sel berisi angka (>= 3 digit) sebagai NIS.
  for (const row of baris) {
    const sel = row.map((c) => c.trim()).filter((c) => c !== '');
    const nama = sel.find((c) => adaHuruf(c) && !/^\d+$/.test(c) && c.length >= 2 && !RE_NAMA.test(c));
    if (!nama) continue;
    const nis = sel.find((c) => /^\d{3,}$/.test(c)) ?? '';
    hasil.push({ nama: bersihkanNama(nama), nis: bersihkanNis(nis) });
  }
  return hasil;
}

function teksSel(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as any;
    if (Array.isArray(o.richText)) return o.richText.map((t: { text: string }) => t.text).join('');
    if ('result' in o) return teksSel(o.result);
    if ('text' in o) return String(o.text);
    if ('hyperlink' in o) return String(o.text ?? o.hyperlink);
    return '';
  }
  return String(v);
}

export async function bacaExcel(buffer: Buffer): Promise<HasilImport> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw galat('File Excel tidak bisa dibaca. Simpan sebagai .xlsx (bukan .xls) lalu coba lagi.');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw galat('File Excel kosong.');

  const baris: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const sel: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) sel.push(teksSel(row.getCell(c).value).trim());
    baris.push(sel);
  });

  const peringatan: string[] = [];
  const siswa = rapikanDaftar(ekstrakDariBaris(baris), peringatan);
  return { siswa, peringatan, sumber: 'excel' };
}

function bacaBarisCsv(teks: string): string[][] {
  const bersih = teks.replace(/^\uFEFF/, '');
  const barisPertama = bersih.split(/\r?\n/, 1)[0] ?? '';
  const pemisah = [';', '\t', ','].reduce(
    (terbaik, p) => (barisPertama.split(p).length > barisPertama.split(terbaik).length ? p : terbaik),
    ','
  );

  const hasil: string[][] = [];
  let baris: string[] = [];
  let sel = '';
  let dalamKutip = false;

  for (let i = 0; i < bersih.length; i++) {
    const ch = bersih[i];
    if (dalamKutip) {
      if (ch === '"' && bersih[i + 1] === '"') {
        sel += '"';
        i++;
      } else if (ch === '"') {
        dalamKutip = false;
      } else {
        sel += ch;
      }
    } else if (ch === '"') {
      dalamKutip = true;
    } else if (ch === pemisah) {
      baris.push(sel.trim());
      sel = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && bersih[i + 1] === '\n') i++;
      baris.push(sel.trim());
      if (baris.some((c) => c !== '')) hasil.push(baris);
      baris = [];
      sel = '';
    } else {
      sel += ch;
    }
  }
  baris.push(sel.trim());
  if (baris.some((c) => c !== '')) hasil.push(baris);
  return hasil;
}

export function bacaCsv(buffer: Buffer): HasilImport {
  const peringatan: string[] = [];
  const siswa = rapikanDaftar(ekstrakDariBaris(bacaBarisCsv(buffer.toString('utf8'))), peringatan);
  return { siswa, peringatan, sumber: 'csv' };
}

// ---------- foto / scan (AI vision) ----------

const hasilFotoSchema = z.object({
  siswa: z.array(
    z.object({
      nama: z.string(),
      nis: z.union([z.string(), z.number()]).nullable().optional(),
    })
  ),
});

const PROMPT_FOTO =
  'Ini foto atau hasil scan DAFTAR SISWA sebuah kelas (daftar hadir, absen, atau buku induk). ' +
  'Ekstrak SETIAP siswa yang terlihat jelas. Balas HANYA dengan JSON valid, tanpa teks lain, dengan bentuk: ' +
  '{"siswa":[{"nama":"...","nis":"..."}]}. Aturan: ' +
  '(1) Salin nama persis seperti tertulis; jangan memperbaiki ejaan dan jangan mengarang nama. ' +
  '(2) Jika NIS/NISN tidak ada atau tidak terbaca, isi "" (string kosong); jangan menebak angka. ' +
  '(3) Abaikan nomor urut, tanda tangan, tanggal, keterangan hadir, nama guru, dan baris judul/header. ' +
  '(4) Jika sebuah nama tidak terbaca jelas, lewati saja. ' +
  '(5) Jika tidak ada daftar siswa pada gambar, balas {"siswa":[]}.';

export async function bacaFoto(buffer: Buffer, mime: string): Promise<HasilImport> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw galat('GROQ_API_KEY belum diatur di file .env', 500);

  const base64 = buffer.toString('base64');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      temperature: 0,
      max_completion_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT_FOTO },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const teks = await response.text();
    throw galat(`Gagal membaca foto dengan AI: ${teks.slice(0, 300)}`, 502);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  const mentah = (data.choices?.[0]?.message?.content ?? '').replace(/```json|```/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(mentah);
  } catch {
    throw galat('AI mengembalikan hasil yang tidak bisa dibaca. Coba foto yang lebih jelas.', 502);
  }

  const cek = hasilFotoSchema.safeParse(parsed);
  if (!cek.success) throw galat('Format hasil AI tidak sesuai. Coba lagi dengan foto yang lebih jelas.', 502);

  const daftar: SiswaImport[] = cek.data.siswa.map((s) => ({
    nama: bersihkanNama(s.nama),
    nis: bersihkanNis(s.nis == null ? '' : String(s.nis)),
  }));

  const peringatan = ['Hasil dibaca AI dari foto dan bisa salah. Periksa setiap nama dan NIS sebelum menyimpan.'];
  const siswa = rapikanDaftar(daftar, peringatan);
  return { siswa, peringatan, sumber: 'foto' };
}

// ---------- template Excel ----------

export async function buatTemplateExcel(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ajarin';
  const sheet = workbook.addWorksheet('Siswa');

  sheet.columns = [
    { header: 'Nama', key: 'nama', width: 38 },
    { header: 'NIS', key: 'nis', width: 20 },
  ];
  sheet.getColumn(3).width = 4;
  sheet.getColumn(4).width = 70;

  ['A1', 'B1'].forEach((addr) => {
    const c = sheet.getCell(addr);
    c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4D3A' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  sheet.getRow(1).height = 22;

  // Kolom NIS diformat teks supaya angka 0 di depan tidak hilang.
  for (let r = 2; r <= 201; r++) {
    sheet.getCell(`A${r}`).font = { name: 'Arial' };
    const nis = sheet.getCell(`B${r}`);
    nis.numFmt = '@';
    nis.font = { name: 'Arial' };
  }

  const petunjuk = [
    'Petunjuk',
    '1. Isi nama siswa di kolom Nama dan NIS di kolom NIS, mulai baris 2.',
    '2. Jangan mengubah tulisan "Nama" dan "NIS" di baris 1.',
    '3. NIS boleh dikosongkan, tetapi sebaiknya diisi agar tidak terjadi data ganda.',
    '4. Simpan sebagai .xlsx, lalu unggah di halaman Kelas & Nilai → tab Siswa.',
    `5. Maksimal ${MAKS_SISWA} siswa per impor. Kolom ini (D) tidak ikut dibaca.`,
  ];
  petunjuk.forEach((teks, i) => {
    const c = sheet.getCell(`D${i + 1}`);
    c.value = teks;
    c.font = { name: 'Arial', size: 10, bold: i === 0, color: { argb: 'FF595959' } };
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return workbook;
}