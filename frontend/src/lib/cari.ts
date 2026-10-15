import type { KelasRingkas, ModulRingkas, SetSoalRingkas } from '../types';
import { JURUSAN_SMA, JURUSAN_SMK } from './akademik';

/** Huruf kecil tanpa tanda aksen, supaya "Bahasa" cocok dengan "bahasa" dan "é" dengan "e". */
export const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Cocok bila SETIAP kata kunci ada di teks, di urutan mana pun:
 * "matematika ganjil" cocok dengan "Matematika Kelas VII Semester Ganjil".
 */
export function cocok(teks: string, kueri: string): boolean {
  const kata = normal(kueri).split(/\s+/).filter(Boolean);
  if (kata.length === 0) return true;
  const t = normal(teks);
  return kata.every((k) => t.includes(k));
}

const NAMA_JURUSAN = Object.fromEntries([...JURUSAN_SMA, ...JURUSAN_SMK]);

// Teks yang dicari per jenis data. Dipakai kolom cari di bilah atas dan penyaring di halaman daftar, supaya hasilnya sama.
export const teksModul = (m: ModulRingkas) =>
  [m.judul, m.topik, m.mapel, m.jenjang, `kelas ${m.kelas}`, m.semester && `semester ${m.semester}`].filter(Boolean).join(' ');

export const teksSoal = (s: SetSoalRingkas) => [s.judul, s.mapel, `kelas ${s.kelas}`].join(' ');

export const teksKelas = (k: KelasRingkas) =>
  [`kelas ${k.nama}`, k.tapel, k.jurusan && NAMA_JURUSAN[k.jurusan]].filter(Boolean).join(' ');
