import ExcelJS from 'exceljs';
import { latexToText } from './latextToText';

export interface SoalRow {
  pertanyaan: string;
  pilihanJawaban: unknown;
  kunciJawaban: string;
  pembahasan?: string | null;
}

export interface SoalSetForExport {
  judul: string;
  mapel: string;
  kelas: string;
  soal: SoalRow[];
}

const FONT = 'Arial';
const COLOR = {
  header: 'FF1F4D3A', // hijau tua
  headerText: 'FFFFFFFF',
  zebra: 'FFF3F7F5',
  key: 'FFD9F0E3', // hijau muda untuk jawaban benar
  keyText: 'FF14532D',
  border: 'FFBFC9C4',
  muted: 'FF5B6B64',
};

const thin = (argb: string): Partial<ExcelJS.Border> => ({ style: 'thin', color: { argb } });
const BORDER: Partial<ExcelJS.Borders> = {
  top: thin(COLOR.border),
  left: thin(COLOR.border),
  bottom: thin(COLOR.border),
  right: thin(COLOR.border),
};

// Perkiraan tinggi baris, karena Excel tidak menghitung otomatis untuk teks yang dibungkus
// saat file dibuat lewat library.
function estimateLines(text: string, width: number): number {
  const charsPerLine = Math.max(1, Math.floor(width * 1.05));
  return text
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

export function buildSoalWorkbook(set: SoalSetForExport): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ajarin';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Soal', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  const columns = [
    { header: 'No', key: 'no', width: 6, align: 'center' as const },
    { header: 'Soal', key: 'soal', width: 52, align: 'left' as const },
    { header: 'Jawaban A', key: 'a', width: 26, align: 'left' as const },
    { header: 'Jawaban B', key: 'b', width: 26, align: 'left' as const },
    { header: 'Jawaban C', key: 'c', width: 26, align: 'left' as const },
    { header: 'Jawaban D', key: 'd', width: 26, align: 'left' as const },
    { header: 'Kunci', key: 'kunci', width: 9, align: 'center' as const },
    { header: 'Pembahasan', key: 'pembahasan', width: 56, align: 'left' as const },
  ];
  const lastCol = columns.length; // 8 -> kolom H
  columns.forEach((c, i) => (sheet.getColumn(i + 1).width = c.width));

  // --- Judul & info (baris 1-2), spasi (baris 3), header tabel (baris 4) ---
  sheet.mergeCells(1, 1, 1, lastCol);
  const title = sheet.getCell(1, 1);
  title.value = set.judul;
  title.font = { name: FONT, size: 16, bold: true, color: { argb: COLOR.header } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, lastCol);
  const info = sheet.getCell(2, 1);
  info.value = `${set.mapel}  ·  Kelas ${set.kelas}  ·  ${set.soal.length} soal`;
  info.font = { name: FONT, size: 10, color: { argb: COLOR.muted } };
  info.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 18;

  sheet.getRow(3).height = 8;

  const headerRow = sheet.getRow(4);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: COLOR.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.header } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER;
  });
  headerRow.height = 24;

  // --- Isi soal ---
  set.soal.forEach((s, i) => {
    const opsiAsli = Array.isArray(s.pilihanJawaban) ? (s.pilihanJawaban as string[]) : [];
    const indeksKunci = opsiAsli.indexOf(s.kunciJawaban);
    const kunciHuruf = indeksKunci >= 0 ? String.fromCharCode(65 + indeksKunci) : '';

    const values: string[] = [
      latexToText(s.pertanyaan),
      ...[0, 1, 2, 3].map((n) => latexToText(opsiAsli[n] ?? '')),
    ];
    const pembahasan = latexToText(s.pembahasan);

    const row = sheet.getRow(5 + i);
    const cells: (string | number)[] = [
      i + 1,
      values[0],
      values[1],
      values[2],
      values[3],
      values[4],
      kunciHuruf || latexToText(s.kunciJawaban),
      pembahasan,
    ];

    let maxLines = 1;
    cells.forEach((v, idx) => {
      const col = columns[idx];
      const cell = row.getCell(idx + 1);
      cell.value = v;
      cell.font = { name: FONT, size: 10 };
      cell.alignment = { vertical: 'top', horizontal: col.align, wrapText: true };
      cell.border = BORDER;
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
      }
      maxLines = Math.max(maxLines, estimateLines(String(v), col.width));
    });

    // Sorot pilihan yang benar + kolom kunci.
    if (indeksKunci >= 0) {
      const optionCell = row.getCell(3 + indeksKunci);
      optionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.key } };
      optionCell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.keyText } };
    }
    const keyCell = row.getCell(7);
    keyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.key } };
    keyCell.font = { name: FONT, size: 11, bold: true, color: { argb: COLOR.keyText } };
    keyCell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };

    row.height = Math.min(409, Math.max(22, maxLines * 14 + 8));
  });

  // Filter di header + judul tabel berulang saat dicetak.
  if (set.soal.length > 0) {
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + set.soal.length, column: lastCol } };
  }
  sheet.pageSetup.printTitlesRow = '4:4';

  // Catatan kaki
  const footerRowNumber = 5 + set.soal.length + 1;
  sheet.mergeCells(footerRowNumber, 1, footerRowNumber, lastCol);
  const footer = sheet.getCell(footerRowNumber, 1);
  footer.value =
    'Rumus matematika ditulis sebagai teks biasa (mis. matriks: (a, b; c, d) = baris dipisah titik koma). Dibuat dengan Ajarin.';
  footer.font = { name: FONT, size: 9, italic: true, color: { argb: COLOR.muted } };
  footer.alignment = { vertical: 'middle', horizontal: 'left' };

  return workbook;
}
