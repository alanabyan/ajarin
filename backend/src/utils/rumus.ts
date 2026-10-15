// Penanda rumus LaTeX yang kadang dipakai AI selain $...$: \( ... \) sebaris dan \[ ... \] tampilan.
// Diubah ke tanda dolar supaya sama dengan aturan rumus di seluruh aplikasi (cermin frontend/src/lib/rumus.ts).
export function rapikanRumus(md: string): string {
  return pipaDalamTabel(
    md
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, isi: string) => `$$${isi.trim()}$$`)
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, isi: string) => `$${isi.trim()}$`)
  );
}

// Perintah LaTeX yang sering dipakai di soal sekolah. Dipakai untuk mengembalikan garis miring yang hilang.
const PERINTAH = [
  'circ', 'degree', 'times', 'div', 'cdot', 'pm', 'mp', 'frac', 'dfrac', 'sqrt', 'pi', 'alpha', 'beta', 'gamma', 'delta',
  'Delta', 'theta', 'lambda', 'mu', 'sigma', 'Sigma', 'omega', 'Omega', 'phi', 'rho', 'le', 'leq', 'ge', 'geq', 'neq',
  'approx', 'infty', 'angle', 'triangle', 'perp', 'parallel', 'rightarrow', 'leftarrow', 'Rightarrow', 'sin', 'cos', 'tan',
  'log', 'ln', 'overline', 'text', 'mathrm', 'left', 'right', 'quad', 'cup', 'cap', 'in', 'notin', 'subset',
];
const POLA_PERINTAH = new RegExp(`(?<![\\\\a-zA-Z])(${PERINTAH.join('|')})(?![a-zA-Z])`, 'g');

/**
 * Memperbaiki LaTeX yang rusak karena aturan escape JSON. AI menulis "\circ" di dalam string JSON; bila tidak
 * digandakan, "\f" (\frac), "\b" (\beta), "\t" (\times, \theta), "\r" (\rightarrow) terbaca sebagai karakter kontrol,
 * dan "\c" (\circ) kehilangan garis miringnya sehingga tampil "70^circ" -> "70ᶜirc".
 */
export function perbaikiLatex(teks: string): string {
  const pulih = teks
    .replace(/\f/g, '\\f')
    .replace(/\u0008/g, '\\b')
    .replace(/\v/g, '\\v')
    // Tab / carriage return yang langsung diikuti huruf hampir pasti sisa \times, \theta, \tan, \rho, \right.
    .replace(/\t(?=[a-zA-Z])/g, '\\t')
    .replace(/\r(?=[a-zA-Z])/g, '\\r');
  // Hanya di dalam $...$ / $$...$$: kata perintah tanpa garis miring diberi garis miring ("^circ" -> "^\circ").
  return pulih.replace(/(\$\$?)([^$]+?)\1/g, (_, d: string, isi: string) => `${d}${isi.replace(POLA_PERINTAH, '\\$1')}${d}`);
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
