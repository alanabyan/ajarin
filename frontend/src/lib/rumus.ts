// Penanda rumus LaTeX yang kadang dipakai AI selain $...$: \( ... \) untuk sebaris dan \[ ... \] untuk tampilan.
// remark-math hanya mengenali tanda dolar, jadi penanda lain diubah dulu supaya rumus tetap dirender KaTeX.
const SEBARIS = /\\\(([\s\S]+?)\\\)/g;
const TAMPILAN = /\\\[([\s\S]+?)\\\]/g;

// Cermin backend/src/utils/rumus.ts: perintah LaTeX yang garis miringnya bisa hilang lewat JSON dari AI.
const PERINTAH = [
  'circ', 'degree', 'times', 'div', 'cdot', 'pm', 'mp', 'frac', 'dfrac', 'sqrt', 'pi', 'alpha', 'beta', 'gamma', 'delta',
  'Delta', 'theta', 'lambda', 'mu', 'sigma', 'Sigma', 'omega', 'Omega', 'phi', 'rho', 'le', 'leq', 'ge', 'geq', 'neq',
  'approx', 'infty', 'angle', 'triangle', 'perp', 'parallel', 'rightarrow', 'leftarrow', 'Rightarrow', 'sin', 'cos', 'tan',
  'log', 'ln', 'overline', 'text', 'mathrm', 'left', 'right', 'quad', 'cup', 'cap', 'in', 'notin', 'subset',
];
const POLA_PERINTAH = new RegExp(`(?<![\\\\a-zA-Z])(${PERINTAH.join('|')})(?![a-zA-Z])`, 'g');

/**
 * Memulihkan LaTeX yang rusak karena escape JSON: "\frac" jadi karakter form feed, "\circ" kehilangan garis miring
 * sehingga "70^circ" tampil "70ᶜirc". Dipakai saat menampilkan, supaya soal lama yang sudah tersimpan ikut benar.
 */
export function perbaikiLatex(teks: string): string {
  const pulih = teks
    .replace(/\f/g, '\\f')
    .replace(/\u0008/g, '\\b')
    .replace(/\v/g, '\\v')
    .replace(/\t(?=[a-zA-Z])/g, '\\t')
    .replace(/\r(?=[a-zA-Z])/g, '\\r');
  return pulih.replace(/(\$\$?)([^$]+?)\1/g, (_, d: string, isi: string) => `${d}${isi.replace(POLA_PERINTAH, '\\$1')}${d}`);
}

export function rapikanRumus(md: string): string {
  const dolar = md.replace(TAMPILAN, (_, isi: string) => `$$${isi.trim()}$$`).replace(SEBARIS, (_, isi: string) => `$${isi.trim()}$`);
  return perbaikiLatex(pipaDalamTabel(dolar));
}

/**
 * Teks tanpa rumus, untuk tempat yang bukan Markdown (pilihan materi, judul, isian formulir):
 * "Distribusi Poisson: asumsi & rumus $P(X=k)=...$" -> "Distribusi Poisson: asumsi & rumus".
 */
export function tanpaRumus(teks: string): string {
  return rapikanRumus(teks)
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    // Sisa kurung kosong setelah rumus dibuang: "Sifat peluang ( , )." -> "Sifat peluang".
    .replace(/[([]\s*[,;]?\s*[,;]?\s*[)\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s:;,.&(\-–]+$/u, '')
    .trim();
}

/**
 * Di baris tabel Markdown, "|" adalah pemisah kolom, termasuk yang ada di dalam rumus. Rumus peluang bersyarat
 * $P(A|B)$ di sel tabel memecah selnya menjadi dua. Di dalam rumus pada baris tabel, "|" diganti \mid (simbolnya sama).
 */
export function pipaDalamTabel(md: string): string {
  return md
    .split('\n')
    .map((baris) =>
      baris.trimStart().startsWith('|')
        ? baris.replace(/(\$\$?)([^$]+?)\1/g, (_, d: string, isi: string) => `${d}${isi.replace(/\\?\|/g, '\\mid ')}${d}`)
        : baris
    )
    .join('\n');
}
