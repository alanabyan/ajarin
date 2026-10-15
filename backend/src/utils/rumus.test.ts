import assert from 'node:assert/strict';
import { test } from 'node:test';
import { perbaikiLatex, rapikanRumus } from './rumus';
import { latexToText } from './latexToText';

test('perbaikiLatex: garis miring yang hilang di dalam rumus dikembalikan', () => {
  assert.equal(perbaikiLatex('dua sudut masing-masing $70^circ$'), 'dua sudut masing-masing $70^\\circ$');
  assert.equal(perbaikiLatex('$180^circ - 70^circ = 110^circ$'), '$180^\\circ - 70^\\circ = 110^\\circ$');
  assert.equal(perbaikiLatex('$3 times 4$ dan $sqrt{9}$'), '$3 \\times 4$ dan $\\sqrt{9}$');
});

test('perbaikiLatex: karakter kontrol hasil escape JSON dipulihkan', () => {
  // JSON "\frac" -> form feed + "rac"; "\times" -> tab + "imes"; "\beta" -> backspace + "eta"
  assert.equal(perbaikiLatex('$\frac{1}{2}$'), '$\\frac{1}{2}$');
  assert.equal(perbaikiLatex('$3 \times 4$'), '$3 \\times 4$');
  assert.equal(perbaikiLatex('$\u0008eta$'), '$\\beta$');
});

test('perbaikiLatex: teks di luar rumus dan LaTeX yang sudah benar tidak diubah', () => {
  assert.equal(perbaikiLatex('Kerjakan dalam waktu tertentu, lalu tentukan sudutnya.'), 'Kerjakan dalam waktu tertentu, lalu tentukan sudutnya.');
  assert.equal(perbaikiLatex('$70^\\circ + \\frac{a}{b}$'), '$70^\\circ + \\frac{a}{b}$');
  assert.equal(perbaikiLatex('baris satu\nbaris dua'), 'baris satu\nbaris dua');
});

test('rapikanRumus: penanda \\( \\) dan \\[ \\] menjadi tanda dolar', () => {
  assert.equal(rapikanRumus('rumus \\(x^2\\) dan \\[y = 1\\]'), 'rumus $x^2$ dan $$y = 1$$');
});

test('latexToText memulihkan LaTeX rusak sebelum diubah ke teks biasa (ekspor Word/Excel)', () => {
  assert.equal(latexToText('$70^circ$'), '70°');
});

test('rapikanRumus: tanda | di dalam rumus pada baris tabel tidak memecah sel', () => {
  const baris = rapikanRumus('| 3 | Peluang bersyarat $P(A|B)$ | 4 |');
  assert.equal(baris.split('|').length, 5); // 3 sel -> 4 pemisah -> 5 potongan
  assert.ok(baris.includes('$P(A\\mid B)$'), baris);
  // Di luar tabel, | dibiarkan (mis. nilai mutlak di paragraf).
  assert.equal(rapikanRumus('Nilai $|x|$ selalu positif'), 'Nilai $|x|$ selalu positif');
});
