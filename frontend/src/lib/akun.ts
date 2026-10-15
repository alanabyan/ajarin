// Batas panjang dan aturan isian akun; sama dengan backend (src/modules/auth.ts).
export const BATAS_AKUN = { nama: 80, email: 100, sekolah: 100, sandi: 72 };

export function galatNama(nama: string): string | undefined {
  const n = nama.trim();
  if (n.length < 2) return 'Nama minimal 2 karakter.';
  if (n.length > BATAS_AKUN.nama) return `Nama maksimal ${BATAS_AKUN.nama} karakter.`;
  if (!/^[\p{L} .,'-]+$/u.test(n)) return 'Nama hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.';
  return undefined;
}

/** Nama sekolah opsional: kosong boleh. */
export function galatSekolah(sekolah: string): string | undefined {
  const s = sekolah.trim();
  if (s.length > BATAS_AKUN.sekolah) return `Nama sekolah maksimal ${BATAS_AKUN.sekolah} karakter.`;
  if (!/^[\p{L}0-9 .,'()/&-]*$/u.test(s)) return 'Nama sekolah hanya boleh berisi huruf, angka, spasi, dan tanda . , \' ( ) / & -';
  return undefined;
}
