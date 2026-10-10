import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { inline, markdownKeBlok, wordModul, wordSoal } from './word';

async function xmlDocx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml')!.async('string');
}

// Teks polos: tag dibuang, elemen tab dijadikan spasi tab.
const teksDocx = async (buf: Buffer) => (await xmlDocx(buf)).replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '');

test('inline membedakan tebal, miring, kode, dan rumus', () => {
  const runs = inline('a **tebal** dan *miring* serta `kode` dan $x^2$');
  assert.equal(runs.length, 8);
});

test('markdownKeBlok mengenali judul, daftar, tabel, dan paragraf bersambung', () => {
  const blok = markdownKeBlok(
    ['## Tujuan', '', '- satu', '- dua', '', '1. langkah', '', '| A | B |', '|---|---|', '| 1 | 2 |', '', 'baris satu', 'baris dua'].join('\n')
  );
  // judul, 2 butir, 1 nomor, tabel, paragraf kosong penutup tabel, 1 paragraf gabungan
  assert.equal(blok.length, 7);
});

test('wordModul menghasilkan .docx valid dengan rumus diubah ke teks', async () => {
  const buf = await wordModul({
    judul: 'Persamaan Linear',
    topik: 'PLSV',
    jenjang: 'SMP',
    kelas: 'VII',
    alokasiWaktu: '2 x 40 menit',
    konten: '## Pendahuluan\n\nSelesaikan $\\frac{1}{2}x \\le 4$ dengan **teliti**.\n\n| No | Kegiatan |\n|---|---|\n| 1 | Apersepsi |\n\n$$x = \\pi$$',
  });
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
  const xml = await xmlDocx(buf);
  const teks = await teksDocx(buf);
  assert.match(teks, /Persamaan Linear/);
  assert.match(xml, /Pendahuluan/);
  assert.match(xml, /1\/2x ≤ 4/);
  assert.match(xml, /x = π/);
  assert.match(xml, /Apersepsi/);
  assert.doesNotMatch(xml, /\\frac/);
  assert.match(xml, /<w:tbl>/);
});

test('wordSoal memuat soal, pilihan, lalu kunci dan pembahasan di halaman terpisah', async () => {
  const buf = await wordSoal({
    judul: 'UH Aljabar',
    mapel: 'Matematika',
    kelas: 'VII',
    butir: [
      { urutan: 1, pertanyaan: 'Hasil $2^3$ adalah...', pilihan: ['6', '8', '9', '12'], kunci: 1, pembahasan: '$2^3 = 8$' },
      { urutan: 2, pertanyaan: 'Hasil 5 + 5?', pilihan: ['9', '10', '11', '12'], kunci: 1, pembahasan: 'Dijumlahkan' },
    ],
  });
  const teks = await teksDocx(buf);
  assert.match(teks, /1\. Hasil 2³ adalah/);
  assert.match(teks, /B\. 8/);
  assert.match(teks, /Kunci Jawaban dan Pembahasan/);
  assert.match(teks, /1\.  Jawaban B\s*2³ = 8/);
  assert.match(await xmlDocx(buf), /w:pageBreakBefore/);
});
