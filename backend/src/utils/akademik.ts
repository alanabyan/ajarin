// Aturan akademik bersama: tingkat kelas per jenjang, fase Kurikulum Merdeka, nama kelas baku, dan
// pemeriksaan teks yang bertentangan dengan jenjang/kelas yang dipilih (mis. judul "SD" tapi jenjang SMK).
// Salinan daftar yang sama ada di frontend (src/lib/akademik.ts); ubah keduanya bersamaan.

export const JENJANG = ['SD', 'SMP', 'SMA', 'SMK'] as const;
export type Jenjang = (typeof JENJANG)[number];

export const KELAS_PER_JENJANG: Record<Jenjang, string[]> = {
  SD: ['I', 'II', 'III', 'IV', 'V', 'VI'],
  SMP: ['VII', 'VIII', 'IX'],
  SMA: ['X', 'XI', 'XII'],
  SMK: ['X', 'XI', 'XII'],
};

export const SEMUA_TINGKAT = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Durasi satu jam pelajaran (menit) menurut Permendikbudristek. */
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

export const kelasCocok = (jenjang: Jenjang, kelas: string) => KELAS_PER_JENJANG[jenjang].includes(kelas);

// --- Nama kelas baku ---------------------------------------------------------------------------------------

export const ROMBEL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/** Jurusan hanya ada di kelas X-XII; huruf besar tanpa spasi berlebih, mis. "rpl" -> "RPL", "tkj 2"? ditolak di skema. */
export const normJurusan = (j: string | null | undefined) => (j ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

export function namaKelasBaku(tingkat: string, jurusan?: string | null, rombel?: string | null): string {
  return [tingkat, normJurusan(jurusan), (rombel ?? '').trim().toUpperCase()].filter(Boolean).join(' ');
}

/** Tahun pelajaran harus "YYYY/YYYY" dengan tahun kedua = tahun pertama + 1. */
export function tapelValid(t: string): boolean {
  const m = /^(\d{4})\/(\d{4})$/.exec(t);
  return !!m && Number(m[2]) === Number(m[1]) + 1 && Number(m[1]) >= 2000 && Number(m[1]) <= 2100;
}

// --- Siswa --------------------------------------------------------------------------------------------------

/** Nama orang: huruf (termasuk beraksen), spasi, titik, koma, apostrof, tanda hubung. */
export const NAMA_ORANG = /^[\p{L} .,'-]{2,100}$/u;
/** NIS/NISN: angka, boleh dipisah titik, garis miring, atau tanda hubung (mis. 212210/125.093); 4-30 karakter. */
export const NIS_VALID = /^[0-9](?:[0-9./-]{2,28})[0-9]$/;

// --- Konflik jenjang/kelas di dalam teks --------------------------------------------------------------------

const ANGKA_KE_ROMAWI: Record<string, string> = Object.fromEntries(SEMUA_TINGKAT.map((r, i) => [String(i + 1), r]));

/** Jenjang yang disebut di teks (SD/MI, SMP/MTs, SMA/MA, SMK). */
function jenjangDisebut(teks: string): Jenjang[] {
  const t = ` ${teks.toUpperCase()} `;
  const ada: Jenjang[] = [];
  if (/[^A-Z](SD|MI|SEKOLAH DASAR)[^A-Z]/.test(t)) ada.push('SD');
  if (/[^A-Z](SMP|MTS|SEKOLAH MENENGAH PERTAMA)[^A-Z]/.test(t)) ada.push('SMP');
  if (/[^A-Z](SMA|MA|SEKOLAH MENENGAH ATAS)[^A-Z]/.test(t)) ada.push('SMA');
  if (/[^A-Z](SMK|SEKOLAH MENENGAH KEJURUAN)[^A-Z]/.test(t)) ada.push('SMK');
  return ada;
}

/** Tingkat kelas yang disebut setelah kata "kelas", dalam angka atau Romawi: "Kelas 10", "kelas VII". */
function kelasDisebut(teks: string): string[] {
  const hasil: string[] = [];
  for (const m of teks.matchAll(/\bkelas\s+([0-9]{1,2}|[IVX]{1,4})\b/gi)) {
    const v = m[1].toUpperCase();
    const romawi = ANGKA_KE_ROMAWI[v] ?? (SEMUA_TINGKAT.includes(v) ? v : '');
    if (romawi) hasil.push(romawi);
  }
  return hasil;
}

export interface MasalahIsian {
  /** Nama kolom formulir yang bermasalah, sama dengan nama properti di body permintaan. */
  bagian: string;
  pesan: string;
}

/**
 * Pemeriksaan pasti (tanpa AI) untuk kolom teks bebas: menyebut jenjang atau kelas lain dari yang dipilih.
 * Contoh: judul "Modul IPA SD kelas 4" dengan jenjang SMK kelas X -> dua masalah pada `judul`.
 */
export function periksaKonflikJenjang(
  kolom: Record<string, string | undefined>,
  label: Record<string, string>,
  jenjang: Jenjang,
  kelas: string
): MasalahIsian[] {
  const masalah: MasalahIsian[] = [];
  for (const [bagian, isi] of Object.entries(kolom)) {
    if (!isi) continue;
    const nama = label[bagian] ?? bagian;
    // SMA dan SMK berbagi kelas X-XII, jadi "SMA" di judul modul SMK tetap dianggap bertentangan.
    const lain = jenjangDisebut(isi).filter((j) => j !== jenjang);
    if (lain.length) {
      masalah.push({ bagian, pesan: `${nama} menyebut jenjang ${lain.join('/')}, padahal jenjang yang dipilih ${jenjang}.` });
    }
    const kelasLain = kelasDisebut(isi).filter((k) => k !== kelas);
    if (kelasLain.length) {
      masalah.push({ bagian, pesan: `${nama} menyebut kelas ${kelasLain.join('/')}, padahal kelas yang dipilih ${kelas}.` });
    }
  }
  return masalah;
}
