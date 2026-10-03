import ExcelJS from 'exceljs';
import { latexToText } from './latextToText';
import type { SoalSetForExport } from './SoalWorkbook';

// Mengikuti template impor resmi Kahoot (KahootQuizTemplate.xlsx):
//   baris 2-6  = judul & petunjuk (di kolom B)
//   baris 8    = header
//   baris 9+   = data soal
//   kolom A = nomor | B = soal | C-F = jawaban 1-4 | G = batas waktu (ANGKA) | H = nomor jawaban benar (TEKS)
// PENTING: kolom H harus bertipe TEKS ("1", bukan angka 1), kalau tidak Kahoot menganggap
// jawaban benar belum ditandai.

export const MAX_SOAL = 120;
export const MAX_JAWABAN = 75;
export const WAKTU_VALID = [5, 10, 20, 30, 60, 90, 120, 240] as const;
export const WAKTU_DEFAULT = 20;

const FONT = 'Arial';
const KAHOOT_PURPLE = 'FF461A8F';
const HEADER_FILL = 'FFF3F3F3';
const RED_FILL = 'FFFFC7CE';
const RED_TEXT = 'FF9C0006';
const BORDER_COLOR = 'FFBFBFBF';

const thin = { style: 'thin' as const, color: { argb: BORDER_COLOR } };
const BORDER: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

const len = (s: string) => [...s].length;

export function normalisasiWaktu(w: unknown): number {
  const n = Number(w);
  return (WAKTU_VALID as readonly number[]).includes(n) ? n : WAKTU_DEFAULT;
}

export interface KahootBuildResult {
  workbook: ExcelJS.Workbook;
  /** Jumlah soal yang punya masalah (melebihi batas karakter / kunci tidak cocok / pilihan kurang). */
  melebihiBatas: number;
}

export function buildKahootWorkbook(set: SoalSetForExport, waktuDetik: number = WAKTU_DEFAULT): KahootBuildResult {
  const waktu = normalisasiWaktu(waktuDetik);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ajarin';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Sheet1', {
    views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
  });

  const widths = [10, 52, 30, 30, 30, 30, 22, 26, 44];
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  // --- Judul & petunjuk (kolom B, seperti template) ---
  const judul = sheet.getCell('B2');
  judul.value = `Quiz template  |  ${set.judul}`;
  judul.font = { name: FONT, size: 14, bold: true, color: { argb: KAHOOT_PURPLE } };
  sheet.getRow(2).height = 24;

  const petunjuk: [string, string][] = [
    [
      'B3',
      'Tambahkan soal, minimal dua pilihan jawaban, batas waktu, dan pilih jawaban yang benar (minimal satu). Soal dimulai dari baris 9.',
    ],
    [
      'B4',
      `Ingat: soal maksimal ${MAX_SOAL} karakter dan jawaban maksimal ${MAX_JAWABAN} karakter. Sel merah = melebihi batas (lihat kolom Catatan). Jika ada beberapa jawaban benar, pisahkan dengan koma.`,
    ],
    ['B6', 'Simpan/unggah dalam format .xlsx. Jangan mengubah, menghapus, atau memindahkan kolom dan header di baris 8.'],
  ];
  petunjuk.forEach(([addr, teks]) => {
    const row = Number(addr.slice(1));
    sheet.mergeCells(`B${row}:H${row}`);
    const cell = sheet.getCell(addr);
    cell.value = teks;
    cell.font = { name: FONT, size: 10, color: { argb: 'FF595959' } };
    cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    sheet.getRow(row).height = 30;
  });

  // --- Header (baris 8) ---
  const headers = [
    'Question - max 120 characters',
    'Answer 1 - max 75 characters',
    'Answer 2 - max 75 characters',
    'Answer 3 - max 75 characters',
    'Answer 4 - max 75 characters',
    'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs',
    'Correct answer(s) - choose at least one',
  ];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(8, i + 2); // mulai kolom B
    cell.value = h;
    cell.font = { name: FONT, size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER;
  });
  sheet.getRow(8).height = 44;

  // --- Data (mulai baris 9) ---
  let bermasalah = 0;
  let adaCatatan = false;

  set.soal.forEach((s, i) => {
    const asli = Array.isArray(s.pilihanJawaban) ? (s.pilihanJawaban as string[]) : [];
    const indeksKunci = asli.indexOf(s.kunciJawaban);
    const soal = latexToText(s.pertanyaan);
    const opsi = [0, 1, 2, 3].map((n) => latexToText(asli[n] ?? ''));

    const r = 9 + i;
    const row = sheet.getRow(r);
    const catatan: string[] = [];

    // A: nomor (angka, ungu seperti template)
    const a = row.getCell(1);
    a.value = i + 1;
    a.font = { name: FONT, size: 11, color: { argb: KAHOOT_PURPLE } };
    a.alignment = { vertical: 'top', horizontal: 'center' };

    // B-F: soal & jawaban (teks)
    [soal, ...opsi].forEach((teks, idx) => {
      const cell = row.getCell(2 + idx);
      cell.value = teks;
      cell.numFmt = '@';
      cell.font = { name: FONT, size: 10 };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = BORDER;
    });

    // G: batas waktu (ANGKA) + daftar pilihan seperti template
    const g = row.getCell(7);
    g.value = waktu;
    g.font = { name: FONT, size: 10 };
    g.alignment = { vertical: 'top', horizontal: 'center' };
    g.border = BORDER;
    g.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${WAKTU_VALID.join(',')}"`],
    };

    // H: nomor jawaban benar sebagai TEKS
    const h = row.getCell(8);
    h.value = indeksKunci >= 0 ? String(indeksKunci + 1) : '';
    h.numFmt = '@';
    h.font = { name: FONT, size: 10 };
    h.alignment = { vertical: 'top', horizontal: 'center' };
    h.border = BORDER;

    // Tandai masalah.
    if (len(soal) > MAX_SOAL) {
      catatan.push(`Soal ${len(soal)} karakter (maks ${MAX_SOAL})`);
      const c = row.getCell(2);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_FILL } };
      c.font = { name: FONT, size: 10, color: { argb: RED_TEXT } };
    }
    opsi.forEach((o, n) => {
      if (len(o) > MAX_JAWABAN) {
        catatan.push(`Jawaban ${n + 1} ${len(o)} karakter (maks ${MAX_JAWABAN})`);
        const c = row.getCell(3 + n);
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_FILL } };
        c.font = { name: FONT, size: 10, color: { argb: RED_TEXT } };
      }
    });
    if (indeksKunci < 0) {
      catatan.push('Kunci jawaban tidak cocok dengan pilihan — isi nomor jawaban benar manual');
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_FILL } };
    }
    if (opsi.filter((o) => o.length > 0).length < 2) catatan.push('Minimal 2 jawaban');

    if (catatan.length > 0) {
      bermasalah++;
      adaCatatan = true;
      const c = row.getCell(9);
      c.value = catatan.join('; ');
      c.font = { name: FONT, size: 9, italic: true, color: { argb: RED_TEXT } };
      c.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    }

    // Perkiraan tinggi baris.
    const baris = Math.max(
      Math.ceil(soal.length / (widths[1] * 1.05)),
      ...opsi.map((o) => Math.ceil(o.length / (widths[2] * 1.05))),
      1
    );
    row.height = Math.min(409, Math.max(20, baris * 14 + 6));
  });

  if (adaCatatan) {
    const hc = sheet.getCell(8, 9);
    hc.value = 'Catatan (tidak ikut diimpor)';
    hc.font = { name: FONT, size: 10, bold: true, color: { argb: RED_TEXT } };
    hc.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }

  return { workbook, melebihiBatas: bermasalah };
}