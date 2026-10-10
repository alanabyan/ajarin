export type Jenjang = 'SD' | 'SMP' | 'SMA' | 'SMK';
export type JenisNilai = 'Tugas' | 'UH' | 'UTS' | 'UAS';

export interface User {
  id: string;
  nama: string;
  email: string;
  jenjang: Jenjang;
  mapel: string;
  sekolah: string | null;
}

export interface ModulRingkas {
  id: string;
  judul: string;
  topik: string;
  jenjang: Jenjang;
  kelas: string;
  alokasiWaktu: string;
  createdAt: string;
  updatedAt: string;
}

export interface Modul extends ModulRingkas {
  tujuanPembelajaran: string;
  kondisiKelas: string | null;
  konten: string;
}

export interface Butir {
  id: string;
  urutan: number;
  materi: string;
  tingkat: string;
  pertanyaan: string;
  pilihan: string[];
  kunci: number;
  pembahasan: string;
  /** Verifikasi ulang AI memberi jawaban berbeda dari kunci: guru perlu memeriksa. */
  ragu: boolean;
}

export interface SetSoalRingkas {
  id: string;
  judul: string;
  mapel: string;
  kelas: string;
  jumlahSoal: number;
  adaForm: boolean;
  createdAt: string;
}

export interface SetSoal {
  id: string;
  judul: string;
  mapel: string;
  kelas: string;
  formUrl: string | null;
  formEditUrl: string | null;
  formKelasId: string | null;
  /** Set remedial: hanya untuk siswa ini di kelas ini (kosong = seluruh kelas). */
  targetKelasId: string | null;
  targetSiswa: string[];
  butir: Butir[];
}

export interface KelasRingkas {
  id: string;
  nama: string;
  tapel: string;
  kkm: number;
  jumlahSiswa: number;
}

export interface Siswa {
  id: string;
  nama: string;
  nis: string;
}

export interface BarisRekap {
  siswaId: string;
  nama: string;
  nis: string;
  nilai: Record<string, number | null>;
  rataRata: number | null;
  tuntas: boolean | null;
}

export interface Rapor {
  siswa: { id: string; nama: string; nis: string };
  kelas: { id: string; nama: string; tapel: string; kkm: number };
  nilai: { id: string; mapel: string; jenis: string; judul: string; nilai: number; tanggal: string }[];
  perMapel: { mapel: string; rataRata: number | null; jumlah: number }[];
  rataRata: number | null;
  rataKelas: number | null;
  tuntas: boolean | null;
}

export type StatusMateri = 'lemah' | 'cukup' | 'kuat';

export interface TitikTren {
  label: string;
  tanggal: string;
  rata: number;
  jumlah: number;
}

export interface RingkasanRemedial {
  setId: string;
  judul: string;
  sumberJudul: string;
  kkm: number;
  jumlahSiswa: number;
  sebelum: number;
  sesudah: number;
  naik: number;
  tuntasBaru: number;
}

export interface Dampak {
  ringkasan: {
    jumlahKelas: number;
    jumlahSiswa: number;
    siswaBerNilai: number;
    rataRata: number | null;
    persenTuntas: number | null;
    jumlahAnalisis: number;
  };
  tren: { kelasId: string; nama: string; kkm: number; titik: TitikTren[] }[];
  materi: { materi: string; persenBenar: number; jumlahSoal: number; status: StatusMateri }[];
  perhatian: { siswaId: string; kelasId: string; kelasNama: string; nama: string; rataRata: number; alasan: string[] }[];
  remedial: {
    sets: RingkasanRemedial[];
    total: { jumlahSet: number; jumlahSiswa: number; naik: number; tuntasBaru: number; sebelum: number | null; sesudah: number | null };
  };
}

export interface Rekap {
  kelas: { id: string; nama: string; tapel: string; kkm: number };
  kolom: string[];
  baris: BarisRekap[];
  ringkasan: { jumlahSiswa: number; rataKelas: number | null; tuntas: number; remedial: number };
}
