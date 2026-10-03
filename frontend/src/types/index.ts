export interface User {
  id: string;
  nama: string;
  email: string;
  jenjang: 'SD' | 'SMP' | 'SMA' | 'SMK';
  mapel: string;
  sekolah?: string;
}

export interface ModulAjar {
  id: string;
  judul: string;
  topik: string;
  jenjang: string;
  kelas: string;
  alokasiWaktu: string;
  kondisiKelas?: string;
  tujuanPembelajaran: string;
  kontenDraf: string;
  status: 'DRAFT' | 'FINAL';
  createdAt: string;
  updatedAt: string;
}

export interface Soal {
  id: string;
  pertanyaan: string;
  pilihanJawaban?: string[];
  kunciJawaban: string;
  pembahasan?: string;
}

export interface AsesmenSet {
  id: string;
  judul: string;
  mapel: string;
  kelas: string;
  createdAt: string;
  soal: Soal[];

  googleFormId?: string | null;
  googleFormUrl?: string | null;
  googleFormEditUrl?: string | null;
  googleFormDibuatPada?: string | null;
}

export interface Siswa {
  id: string;
  nama: string;
  nis: string;
  kelasId: string;
}

export interface Kelas {
  id: string;
  nama: string;
  tapel: string;
  siswa: Siswa[];
}

export interface Nilai {
  id: string;
  mapel: string;
  jenis: string;
  nilai: number;
  tanggal: string;
}
