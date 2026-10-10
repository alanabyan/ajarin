import ExcelJS from 'exceljs';
import { latexToText } from './latexToText';

export interface SetUntukEkspor {
  judul: string;
  mapel: string;
  kelas: string;
  butir: { urutan: number; pertanyaan: string; pilihan: unknown; kunci: number; pembahasan: string }[];
}

const pilihanArray = (p: unknown): string[] => (Array.isArray(p) ? p.map(String) : []);
const huruf = (i: number) => String.fromCharCode(65 + i);

function lembar(wb: ExcelJS.Workbook, nama: string) {
  wb.creator = 'Ajarin';
  wb.created = new Date();
  return wb.addWorksheet(nama);
}

function tebalkanHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F0' } };
}

// Arsip / cetak: soal, pilihan, kunci, dan pembahasan. Rumus diubah ke teks Unicode karena Excel tidak merender LaTeX.
export function excelSoalLengkap(set: SetUntukEkspor): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = lembar(wb, 'Soal');
  ws.columns = [
    { header: 'No', width: 5 },
    { header: 'Soal', width: 60 },
    { header: 'A', width: 28 },
    { header: 'B', width: 28 },
    { header: 'C', width: 28 },
    { header: 'D', width: 28 },
    { header: 'Kunci', width: 8 },
    { header: 'Pembahasan', width: 60 },
  ];
  tebalkanHeader(ws.getRow(1));
  set.butir.forEach((b, i) => {
    const p = pilihanArray(b.pilihan).map((x) => latexToText(x));
    const row = ws.addRow([i + 1, latexToText(b.pertanyaan), p[0], p[1], p[2], p[3], huruf(b.kunci), latexToText(b.pembahasan)]);
    row.alignment = { vertical: 'top', wrapText: true };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return wb;
}

export const MAKS_SOAL = 120;
export const MAKS_JAWABAN = 75;
export const WAKTU_KAHOOT = [5, 10, 20, 30, 60, 90, 120, 240];

export function waktuKahootValid(w: unknown): number {
  const n = Number(w);
  return WAKTU_KAHOOT.includes(n) ? n : 20;
}

// Mengikuti template impor Kahoot: header di baris 8, data mulai baris 9, kolom A nomor,
// B soal, C-F jawaban 1-4, G batas waktu (angka), H nomor jawaban benar (TEKS).
export function excelKahoot(set: SetUntukEkspor, waktu: number): { workbook: ExcelJS.Workbook; melebihiBatas: number } {
  const wb = new ExcelJS.Workbook();
  const ws = lembar(wb, 'Sheet1');
  [8, 52, 30, 30, 30, 30, 20, 24].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getCell('B2').value = `Quiz template | ${set.judul}`;
  ws.getCell('B2').font = { bold: true, size: 14 };
  ws.getCell('B3').value = `Soal maksimal ${MAKS_SOAL} karakter dan jawaban maksimal ${MAKS_JAWABAN} karakter. Sel merah melebihi batas.`;
  ws.getCell('B4').value = 'Unggah lewat Kahoot: Add question > Import spreadsheet. Jangan ubah header di baris 8.';

  const header = [
    'Question - max 120 characters',
    'Answer 1 - max 75 characters',
    'Answer 2 - max 75 characters',
    'Answer 3 - max 75 characters',
    'Answer 4 - max 75 characters',
    'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs',
    'Correct answer(s) - choose at least one',
  ];
  header.forEach((h, i) => (ws.getCell(8, i + 2).value = h));
  tebalkanHeader(ws.getRow(8));
  ws.getRow(8).height = 44;

  const merah: Partial<ExcelJS.Fill> = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
  let bermasalah = 0;

  set.butir.forEach((b, i) => {
    const r = 9 + i;
    const soal = latexToText(b.pertanyaan);
    const p = pilihanArray(b.pilihan).map((x) => latexToText(x));
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 2).value = soal;
    p.slice(0, 4).forEach((teks, n) => (ws.getCell(r, 3 + n).value = teks));
    ws.getCell(r, 7).value = waktu;
    ws.getCell(r, 8).value = String(b.kunci + 1); // harus teks, bukan angka
    ws.getCell(r, 8).numFmt = '@';

    let salah = false;
    if ([...soal].length > MAKS_SOAL) {
      ws.getCell(r, 2).fill = merah as ExcelJS.Fill;
      salah = true;
    }
    p.slice(0, 4).forEach((teks, n) => {
      if ([...teks].length > MAKS_JAWABAN) {
        ws.getCell(r, 3 + n).fill = merah as ExcelJS.Fill;
        salah = true;
      }
    });
    if (salah) bermasalah++;
    ws.getRow(r).alignment = { vertical: 'top', wrapText: true };
  });

  return { workbook: wb, melebihiBatas: bermasalah };
}

export interface BarisRekap {
  nama: string;
  nis: string;
  nilai: Record<string, number | null>;
  rataRata: number | null;
  tuntas: boolean | null;
}

export function excelRekap(
  judul: string,
  kkm: number,
  kolom: string[],
  baris: BarisRekap[]
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = lembar(wb, 'Rekap Nilai');
  ws.addRow([judul]).font = { bold: true, size: 14 };
  ws.addRow([`KKM: ${kkm}`]);
  ws.addRow([]);
  const header = ws.addRow(['No', 'Nama', 'NIS', ...kolom, 'Rata-rata', 'Status']);
  tebalkanHeader(header);
  baris.forEach((b, i) => {
    ws.addRow([
      i + 1,
      b.nama,
      b.nis,
      ...kolom.map((k) => b.nilai[k] ?? ''),
      b.rataRata === null ? '' : Math.round(b.rataRata * 10) / 10,
      b.tuntas === null ? '' : b.tuntas ? 'Tuntas' : 'Remedial',
    ]);
  });
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 16;
  kolom.forEach((_, i) => (ws.getColumn(4 + i).width = 14));
  ws.getColumn(4 + kolom.length).width = 12;
  ws.getColumn(5 + kolom.length).width = 12;
  return wb;
}
