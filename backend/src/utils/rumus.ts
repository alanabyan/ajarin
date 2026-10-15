// Penanda rumus LaTeX yang kadang dipakai AI selain $...$: \( ... \) sebaris dan \[ ... \] tampilan.
// Diubah ke tanda dolar supaya sama dengan aturan rumus di seluruh aplikasi (cermin frontend/src/lib/rumus.ts).
export function rapikanRumus(md: string): string {
  return md
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, isi: string) => `$$${isi.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, isi: string) => `$${isi.trim()}$`);
}
