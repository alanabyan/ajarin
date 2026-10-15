// Penanda rumus LaTeX yang kadang dipakai AI selain $...$: \( ... \) untuk sebaris dan \[ ... \] untuk tampilan.
// remark-math hanya mengenali tanda dolar, jadi penanda lain diubah dulu supaya rumus tetap dirender KaTeX.
const SEBARIS = /\\\(([\s\S]+?)\\\)/g;
const TAMPILAN = /\\\[([\s\S]+?)\\\]/g;

export function rapikanRumus(md: string): string {
  return md.replace(TAMPILAN, (_, isi: string) => `$$${isi.trim()}$$`).replace(SEBARIS, (_, isi: string) => `$${isi.trim()}$`);
}

/**
 * Teks tanpa rumus, untuk tempat yang bukan Markdown (pilihan materi, judul, isian formulir):
 * "Distribusi Poisson: asumsi & rumus $P(X=k)=...$" -> "Distribusi Poisson: asumsi & rumus".
 */
export function tanpaRumus(teks: string): string {
  return rapikanRumus(teks)
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s:;,&(\-–]+$/u, '')
    .trim();
}
