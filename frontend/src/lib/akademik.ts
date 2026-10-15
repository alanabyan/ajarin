import { tanpaRumus } from './rumus';
import type { Jenjang } from '../types';

// Cermin dari backend/src/utils/akademik.ts; ubah keduanya bersamaan.

export const JENJANG: Jenjang[] = ['SD', 'SMP', 'SMA', 'SMK'];

export const KELAS_PER_JENJANG: Record<Jenjang, string[]> = {
  SD: ['I', 'II', 'III', 'IV', 'V', 'VI'],
  SMP: ['VII', 'VIII', 'IX'],
  SMA: ['X', 'XI', 'XII'],
  SMK: ['X', 'XI', 'XII'],
};

export const SEMUA_TINGKAT = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const TINGKAT_ATAS = ['X', 'XI', 'XII'];

/** Durasi satu jam pelajaran (menit). */
export const MENIT_PER_JP: Record<Jenjang, number> = { SD: 35, SMP: 40, SMA: 45, SMK: 45 };

export function fase(kelas: string): string {
  const n = SEMUA_TINGKAT.indexOf(kelas) + 1;
  if (n <= 0) return '';
  if (n <= 2) return 'A';
  if (n <= 4) return 'B';
  if (n <= 6) return 'C';
  if (n <= 9) return 'D';
  if (n === 10) return 'E';
  return 'F';
}

/** Maksimal siswa sekali tambah lewat Excel/CSV atau tempel dari spreadsheet (sama dengan server). */
export const BATAS_IMPOR_SISWA = 60;

export const NAMA_ORANG = /^[\p{L} .,'-]{2,100}$/u;
export const NIS_VALID = /^[0-9](?:[0-9./-]{2,28})[0-9]$/;

export const ROMBEL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/** Pilihan jurusan [singkatan, nama lengkap]. Singkatan yang dipakai di nama kelas, mis. "X RPL 1". */
export const JURUSAN_SMA: [string, string][] = [
  ['IPA', 'Ilmu Pengetahuan Alam'],
  ['IPS', 'Ilmu Pengetahuan Sosial'],
  ['BAHASA', 'Bahasa dan Budaya'],
];

export const JURUSAN_SMK: [string, string][] = [
  ['RPL', 'Rekayasa Perangkat Lunak'],
  ['TKJ', 'Teknik Komputer dan Jaringan'],
  ['DKV', 'Desain Komunikasi Visual'],
  ['MM', 'Multimedia'],
  ['AKL', 'Akuntansi dan Keuangan Lembaga'],
  ['MPLB', 'Manajemen Perkantoran dan Layanan Bisnis'],
  ['OTKP', 'Otomatisasi dan Tata Kelola Perkantoran'],
  ['BDP', 'Bisnis Daring dan Pemasaran'],
  ['PM', 'Pemasaran'],
  ['TKR', 'Teknik Kendaraan Ringan'],
  ['TBSM', 'Teknik dan Bisnis Sepeda Motor'],
  ['TITL', 'Teknik Instalasi Tenaga Listrik'],
  ['TAV', 'Teknik Audio Video'],
  ['TP', 'Teknik Pemesinan'],
  ['TPM', 'Teknik Pengelasan dan Fabrikasi Logam'],
  ['DPIB', 'Desain Pemodelan dan Informasi Bangunan'],
  ['KUL', 'Kuliner'],
  ['PH', 'Perhotelan'],
  ['TB', 'Tata Busana'],
  ['TKC', 'Tata Kecantikan'],
  ['UPW', 'Usaha Layanan Pariwisata'],
  ['FKK', 'Farmasi Klinis dan Komunitas'],
  ['KEP', 'Keperawatan'],
  ['ATPH', 'Agribisnis Tanaman Pangan dan Hortikultura'],
  ['APHP', 'Agribisnis Pengolahan Hasil Pertanian'],
];

export const normJurusan = (j: string) => j.trim().replace(/\s+/g, '').toUpperCase();

export function namaKelasBaku(tingkat: string, jurusan?: string, rombel?: string): string {
  return [tingkat, normJurusan(jurusan ?? ''), (rombel ?? '').trim().toUpperCase()].filter(Boolean).join(' ');
}

/** Tahun pelajaran (Juli-Juni) yang sedang berjalan, mis. "2026/2027". */
export function tapelSekarang(d = new Date()): string {
  const mulai = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${mulai}/${mulai + 1}`;
}

/** Pilihan tahun pelajaran: tahun lalu, sekarang, dan tahun depan. */
export function pilihanTapel(): string[] {
  const mulai = Number(tapelSekarang().slice(0, 4));
  return [mulai - 1, mulai, mulai + 1].map((t) => `${t}/${t + 1}`);
}

/** Semester berjalan: Juli-Desember ganjil, Januari-Juni genap. */
export const semesterSekarang = (d = new Date()) => (d.getMonth() >= 6 ? 'Ganjil' : 'Genap');

const UMUM = ['Pendidikan Agama dan Budi Pekerti', 'Pendidikan Pancasila', 'Bahasa Indonesia', 'Matematika', 'Bahasa Inggris', 'PJOK'];

/** Mata pelajaran Kurikulum Merdeka per jenjang. Pilihan "Lainnya" tetap tersedia di formulir. */
export const MAPEL_PER_JENJANG: Record<Jenjang, string[]> = {
  SD: [...UMUM, 'IPAS', 'Seni Musik', 'Seni Rupa', 'Seni Tari', 'Seni Teater', 'Muatan Lokal'],
  SMP: [...UMUM, 'IPA', 'IPS', 'Informatika', 'Seni Budaya', 'Prakarya', 'Muatan Lokal'],
  SMA: [
    ...UMUM,
    'IPA',
    'IPS',
    'Fisika',
    'Kimia',
    'Biologi',
    'Ekonomi',
    'Sosiologi',
    'Geografi',
    'Sejarah',
    'Antropologi',
    'Informatika',
    'Seni Budaya',
    'Matematika Tingkat Lanjut',
    'Bahasa Inggris Tingkat Lanjut',
  ],
  SMK: [
    ...UMUM,
    'Sejarah',
    'Seni Budaya',
    'Informatika',
    'Projek IPAS',
    'Dasar-dasar Program Keahlian',
    'Konsentrasi Keahlian',
    'Projek Kreatif dan Kewirausahaan',
    'Mata Pelajaran Pilihan',
  ],
};

/**
 * Jenjang dari kelas yang sudah dibuat guru. Kelas X-XII bisa SMA atau SMK: ditentukan dari jurusannya,
 * lalu dari jenjang akun guru.
 */
export function jenjangDariKelas(tingkat: string, jurusan: string | null | undefined, jenjangGuru: Jenjang | null): Jenjang {
  if (KELAS_PER_JENJANG.SD.includes(tingkat)) return 'SD';
  if (KELAS_PER_JENJANG.SMP.includes(tingkat)) return 'SMP';
  if (jurusan && JURUSAN_SMK.some(([k]) => k === jurusan)) return 'SMK';
  if (jurusan && JURUSAN_SMA.some(([k]) => k === jurusan)) return 'SMA';
  return jenjangGuru === 'SMK' ? 'SMK' : 'SMA';
}

/**
 * Daftar materi dari modul: kolom "Materi Pokok" di tabel rencana per pertemuan (tanpa baris asesmen),
 * atau bila tidak ada tabel, cakupan materi yang dipisah koma.
 */
export function materiDariModul(konten: string, topik: string): string[] {
  const baris = konten.split(/\r?\n/);
  const sel = (b: string) => b.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const hasil: string[] = [];
  for (let i = 0; i < baris.length; i++) {
    if (!baris[i].trim().startsWith('|')) continue;
    const kolom = sel(baris[i]).findIndex((c) => /materi\s*pokok/i.test(c));
    if (kolom < 0) continue;
    // i + 1 adalah baris pemisah |---|, isi tabel mulai i + 2.
    for (let j = i + 2; j < baris.length && baris[j].trim().startsWith('|'); j++) {
      // Rumus dibuang: pilihan materi berupa teks biasa, bukan Markdown, jadi $...$ akan tampil mentah.
      const isi = tanpaRumus(sel(baris[j])[kolom]?.replace(/\*\*/g, '') ?? '');
      if (isi && !/asesmen|ujian|\bUTS\b|\bUAS\b|^-+$/i.test(isi)) hasil.push(isi);
    }
    break;
  }
  const daftar = hasil.length ? hasil : tanpaRumus(topik).split(/[,;]/).map((t) => t.trim());
  return [...new Set(daftar.filter((t) => t.length >= 3))].slice(0, 24);
}

/** Semua mata pelajaran resmi lintas jenjang, tanpa duplikat (cermin MAPEL_RESMI di backend). */
export const MAPEL_RESMI = [...new Set(Object.values(MAPEL_PER_JENJANG).flat())];
