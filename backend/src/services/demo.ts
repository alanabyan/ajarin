import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { namaKelasBaku } from '../utils/akademik';

export const EMAIL_DEMO = 'demo@pelitaguru.id';

// Data demo disusun ulang bila set penanda ini belum ada: akun demo versi lama, atau pengunjung menghapusnya.
// Ganti judulnya setiap kali isi data demo diubah supaya akun demo yang sudah ada ikut diperbarui.
const PENANDA = 'Latihan Persamaan Garis Lurus';

const HARI = 24 * 60 * 60 * 1000;
const lalu = (hari: number) => new Date(Date.now() - hari * HARI);
const MAPEL = 'Matematika';
const TAPEL = '2026/2027';

// --- Modul ajar (format rencana semester / RPS) -----------------------------------------------------------

const MODUL_VII = `## Identitas
- Sekolah: SMP Negeri Contoh
- Mata pelajaran: Matematika
- Jenjang / kelas / fase: SMP / VII / Fase D
- Semester: Ganjil
- Jumlah pertemuan: 16
- Alokasi waktu: 2 JP × 40 menit per pertemuan
- Guru pengampu: Bu Siti

## Deskripsi Singkat
Semester ini membangun dasar bilangan dan aljabar: operasi bilangan bulat dan pecahan, perbandingan, bentuk aljabar, persamaan dan pertidaksamaan linear satu variabel, sampai aritmetika sosial. Pembelajaran berangkat dari masalah sehari-hari dan ditutup dengan proyek anggaran belanja kelas.

## Capaian Pembelajaran (CP)
Di akhir Fase D, peserta didik dapat membaca, menulis, dan membandingkan bilangan bulat dan pecahan; menggunakan operasi aritmetika dan perbandingan untuk menyelesaikan masalah; serta menyatakan situasi ke dalam bentuk aljabar dan menyelesaikan persamaan dan pertidaksamaan linear satu variabel.

## Tujuan Pembelajaran (TP)
1. TP-1: Melakukan operasi hitung bilangan bulat dan pecahan serta menggunakannya pada masalah kontekstual.
2. TP-2: Menyelesaikan masalah perbandingan senilai dan berbalik nilai.
3. TP-3: Menyederhanakan bentuk aljabar dan melakukan operasi pada bentuk aljabar.
4. TP-4: Menyelesaikan persamaan dan pertidaksamaan linear satu variabel, termasuk soal cerita.
5. TP-5: Menerapkan aritmetika sosial (untung, rugi, diskon, pajak, bunga) dalam keputusan sehari-hari.

## Rencana Pembelajaran per Pertemuan
| Pertemuan ke- | TP | Indikator Ketercapaian | Materi Pokok | Metode & Bentuk Pembelajaran (estimasi waktu) | Kriteria & Bentuk Penilaian | Bobot (%) |
|---|---|---|---|---|---|---|
| 1 | TP-1 | Menghitung penjumlahan dan pengurangan bilangan bulat dengan garis bilangan | Operasi bilangan bulat | Diskusi kelompok dengan garis bilangan (80 menit) | Ketepatan hitung; kuis 5 soal | 3 |
| 2 | TP-1 | Menyelesaikan masalah suhu dan utang-piutang | Sifat operasi bilangan bulat | Problem based learning (80 menit) | Langkah penyelesaian; lembar kerja | 3 |
| 3 | TP-1 | Mengubah dan mengoperasikan pecahan, desimal, persen | Pecahan dan desimal | Demonstrasi dan latihan berpasangan (80 menit) | Ketepatan konversi; tugas individu | 4 |
| 4 | TP-2 | Menentukan nilai pada perbandingan senilai | Perbandingan senilai | Eksplorasi resep masakan (80 menit) | Ketepatan model perbandingan; lembar kerja | 4 |
| 5 | TP-2 | Membedakan dan menyelesaikan perbandingan berbalik nilai | Perbandingan berbalik nilai | Diskusi kasus pekerja dan waktu (80 menit) | Ketepatan alasan; kuis 5 soal | 4 |
| 6 | TP-3 | Mengidentifikasi variabel, koefisien, konstanta, suku sejenis | Unsur bentuk aljabar | Kartu aljabar dan tanya jawab (80 menit) | Ketepatan identifikasi; observasi | 3 |
| 7 | TP-3 | Menjumlah, mengurang, dan mengalikan bentuk aljabar | Operasi bentuk aljabar | Latihan terbimbing (80 menit) | Ketepatan operasi; tugas individu | 4 |
| 8 | TP-1–TP-3 | Mengerjakan soal TP-1 sampai TP-3 | Asesmen Tengah Semester | Tes tertulis (80 menit) | Skor tes pilihan ganda dan uraian | 20 |
| 9 | TP-4 | Menentukan penyelesaian persamaan bentuk $ax + b = c$ | Persamaan linear: bentuk dasar | Timbangan seimbang (80 menit) | Ketepatan langkah; kuis 5 soal | 4 |
| 10 | TP-4 | Menyelesaikan persamaan dua langkah, variabel di kedua ruas | Persamaan linear: dua langkah | Latihan berpasangan (80 menit) | Ketepatan langkah; lembar kerja | 4 |
| 11 | TP-4 | Memodelkan soal cerita menjadi persamaan dan menyelesaikannya | Soal cerita persamaan linear | Problem based learning (80 menit) | Model dan jawaban; tugas kelompok | 5 |
| 12 | TP-4 | Menentukan himpunan penyelesaian pertidaksamaan | Pertidaksamaan linear satu variabel | Diskusi dan garis bilangan (80 menit) | Ketepatan himpunan penyelesaian; kuis | 4 |
| 13 | TP-5 | Menghitung untung, rugi, dan persentasenya | Aritmetika sosial: untung dan rugi | Simulasi jual beli (80 menit) | Ketepatan hitung; lembar kerja | 4 |
| 14 | TP-5 | Menghitung diskon, pajak, dan bunga tunggal | Aritmetika sosial: diskon, pajak, bunga | Studi brosur belanja (80 menit) | Ketepatan hitung; tugas individu | 4 |
| 15 | TP-2, TP-5 | Menyusun anggaran belanja kelas yang masuk akal | Proyek anggaran belanja kelas | Pembelajaran berbasis proyek (80 menit) | Rubrik proyek: ketepatan, kewajaran, presentasi | 10 |
| 16 | TP-1–TP-5 | Mengerjakan soal seluruh TP | Asesmen Akhir Semester | Tes tertulis (80 menit) | Skor tes pilihan ganda dan uraian | 20 |

## Komposisi Penilaian
| Komponen | Bobot (%) |
|---|---|
| Formatif (kuis, lembar kerja, tugas pertemuan 1–7 dan 9–14) | 50 |
| Asesmen Tengah Semester | 20 |
| Proyek anggaran belanja kelas | 10 |
| Asesmen Akhir Semester | 20 |
| **Total** | **100** |

## Sumber Belajar
- Buku Siswa Matematika SMP/MTs Kelas VII Kurikulum Merdeka, Kemendikbudristek.
- Buku Panduan Guru Matematika Kelas VII, Kemendikbudristek.
- Brosur belanja dan struk pembelian dari lingkungan sekitar siswa.
`;

const MODUL_VIII = `## Identitas
- Sekolah: SMP Negeri Contoh
- Mata pelajaran: Matematika
- Jenjang / kelas / fase: SMP / VIII / Fase D
- Semester: Ganjil
- Jumlah pertemuan: 16
- Alokasi waktu: 2 JP × 40 menit per pertemuan
- Guru pengampu: Bu Siti

## Deskripsi Singkat
Semester ini mengajak peserta didik melihat keteraturan: pola bilangan, letak titik pada bidang koordinat, relasi dan fungsi, persamaan garis lurus, hingga sistem persamaan linear dua variabel (SPLDV). Setiap topik diawali dari data atau situasi nyata, misalnya tarif ojek daring dan susunan kursi gedung, lalu ditutup dengan proyek grafik tarif.

## Capaian Pembelajaran (CP)
Di akhir Fase D, peserta didik dapat mengenali, memprediksi, dan menggeneralisasi pola bilangan; memahami relasi dan fungsi serta menyajikannya dalam berbagai bentuk; menentukan persamaan garis lurus; dan menyelesaikan sistem persamaan linear dua variabel dalam masalah kontekstual.

## Tujuan Pembelajaran (TP)
1. TP-1: Menentukan suku berikutnya dan rumus suku ke-$n$ dari pola bilangan.
2. TP-2: Menentukan posisi titik dan garis pada bidang koordinat Kartesius.
3. TP-3: Menyajikan relasi dan fungsi, serta menghitung nilai fungsi.
4. TP-4: Menentukan gradien dan persamaan garis lurus dari titik, grafik, atau situasi.
5. TP-5: Menyelesaikan SPLDV dengan grafik, substitusi, dan eliminasi pada masalah sehari-hari.

## Rencana Pembelajaran per Pertemuan
| Pertemuan ke- | TP | Indikator Ketercapaian | Materi Pokok | Metode & Bentuk Pembelajaran (estimasi waktu) | Kriteria & Bentuk Penilaian | Bobot (%) |
|---|---|---|---|---|---|---|
| 1 | TP-1 | Melanjutkan pola gambar dan pola bilangan | Pola bilangan | Eksplorasi pola noktah dan korek api (80 menit) | Ketepatan pola; lembar kerja | 3 |
| 2 | TP-1 | Menentukan suku ke-$n$ barisan aritmetika | Barisan aritmetika | Diskusi kelompok (80 menit) | Ketepatan rumus; kuis 5 soal | 3 |
| 3 | TP-1 | Menyelesaikan soal cerita pola bilangan | Soal cerita pola bilangan | Problem based learning (80 menit) | Model dan jawaban; tugas individu | 4 |
| 4 | TP-2 | Menentukan koordinat titik terhadap titik asal dan titik tertentu | Koordinat Kartesius | Permainan peta kelas (80 menit) | Ketepatan koordinat; observasi | 4 |
| 5 | TP-2 | Menentukan posisi garis sejajar, tegak lurus, dan berpotongan | Posisi garis pada bidang koordinat | Latihan berpasangan (80 menit) | Ketepatan posisi; lembar kerja | 4 |
| 6 | TP-3 | Menyajikan relasi dengan diagram panah, pasangan berurutan, dan grafik | Relasi | Diskusi data kelas (80 menit) | Ketepatan penyajian; tugas individu | 3 |
| 7 | TP-3 | Membedakan fungsi dan bukan fungsi serta menghitung nilai fungsi | Fungsi dan nilai fungsi | Latihan terbimbing (80 menit) | Ketepatan alasan dan hitung; kuis 5 soal | 4 |
| 8 | TP-1–TP-3 | Mengerjakan soal TP-1 sampai TP-3 | Asesmen Tengah Semester | Tes tertulis (80 menit) | Skor tes pilihan ganda dan uraian | 20 |
| 9 | TP-4 | Menghitung gradien dari dua titik dan dari persamaan | Gradien | Eksplorasi tangga dan bidang miring (80 menit) | Ketepatan gradien; kuis | 4 |
| 10 | TP-4 | Menyusun persamaan garis dari titik dan gradien | Persamaan garis lurus | Latihan berpasangan (80 menit) | Ketepatan persamaan; lembar kerja | 4 |
| 11 | TP-4 | Memodelkan tarif ojek daring sebagai persamaan garis | Penerapan persamaan garis lurus | Problem based learning (80 menit) | Model dan grafik; tugas kelompok | 5 |
| 12 | TP-5 | Menyelesaikan SPLDV dengan metode grafik | SPLDV: metode grafik | Demonstrasi GeoGebra (80 menit) | Ketepatan titik potong; lembar kerja | 4 |
| 13 | TP-5 | Menyelesaikan SPLDV dengan substitusi dan eliminasi | SPLDV: substitusi dan eliminasi | Latihan terbimbing (80 menit) | Ketepatan langkah; kuis | 4 |
| 14 | TP-5 | Menyelesaikan soal cerita SPLDV | Soal cerita SPLDV | Diskusi kasus belanja (80 menit) | Model dan jawaban; tugas individu | 4 |
| 15 | TP-4, TP-5 | Membuat dan mempresentasikan grafik tarif dua penyedia jasa | Proyek grafik tarif | Pembelajaran berbasis proyek (80 menit) | Rubrik proyek: ketepatan, grafik, presentasi | 10 |
| 16 | TP-1–TP-5 | Mengerjakan soal seluruh TP | Asesmen Akhir Semester | Tes tertulis (80 menit) | Skor tes pilihan ganda dan uraian | 20 |

## Komposisi Penilaian
| Komponen | Bobot (%) |
|---|---|
| Formatif (kuis, lembar kerja, tugas pertemuan 1–7 dan 9–14) | 50 |
| Asesmen Tengah Semester | 20 |
| Proyek grafik tarif | 10 |
| Asesmen Akhir Semester | 20 |
| **Total** | **100** |

## Sumber Belajar
- Buku Siswa Matematika SMP/MTs Kelas VIII Kurikulum Merdeka, Kemendikbudristek.
- Buku Panduan Guru Matematika Kelas VIII, Kemendikbudristek.
- GeoGebra Classic (geogebra.org) untuk menggambar grafik.
- Daftar tarif ojek daring dan angkutan kota di sekitar sekolah.
`;

const MODUL: Omit<Prisma.ModulCreateManyInput, 'userId'>[] = [
  {
    judul: 'Bilangan, Aljabar, dan Persamaan Linear',
    mapel: MAPEL,
    topik: 'Bilangan bulat dan pecahan, perbandingan, bentuk aljabar, persamaan dan pertidaksamaan linear, aritmetika sosial',
    jenjang: 'SMP',
    kelas: 'VII',
    semester: 'Ganjil',
    jumlahPertemuan: 16,
    alokasiWaktu: '2 JP × 40 menit per pertemuan',
    tujuanPembelajaran:
      'Peserta didik mampu mengoperasikan bilangan dan bentuk aljabar, menyelesaikan persamaan dan pertidaksamaan linear satu variabel, serta menerapkannya pada masalah sehari-hari.',
    kondisiKelas: 'Dua rombel (VII A dan VII B), 22-24 siswa per kelas; sebagian siswa masih tertukar tanda saat mengoperasikan bilangan negatif.',
    konten: MODUL_VII,
    createdAt: lalu(95),
    updatedAt: lalu(30),
  },
  {
    judul: 'Pola Bilangan, Fungsi, dan Persamaan Garis Lurus',
    mapel: MAPEL,
    topik: 'Pola bilangan, koordinat Kartesius, relasi dan fungsi, persamaan garis lurus, sistem persamaan linear dua variabel',
    jenjang: 'SMP',
    kelas: 'VIII',
    semester: 'Ganjil',
    jumlahPertemuan: 16,
    alokasiWaktu: '2 JP × 40 menit per pertemuan',
    tujuanPembelajaran:
      'Peserta didik mampu menggeneralisasi pola bilangan, menyajikan relasi dan fungsi, menentukan persamaan garis lurus, dan menyelesaikan SPLDV dalam masalah kontekstual.',
    kondisiKelas: 'VIII A, 20 siswa; laboratorium komputer bisa dipakai untuk GeoGebra dua kali sebulan.',
    konten: MODUL_VIII,
    createdAt: lalu(92),
    updatedAt: lalu(12),
  },
];

// --- Kelas dan siswa ---------------------------------------------------------------------------------------

/** Penilaian satu kelas. `geser` menaikkan atau menurunkan nilai seluruh kelas (penilaian mudah atau sulit). */
interface Penilaian {
  jenis: 'Tugas' | 'UH' | 'UTS' | 'UAS';
  judul: string;
  hari: number;
  geser: number;
}

interface KelasDemo {
  kunci: string;
  tingkat: string;
  rombel: string;
  kkm: number;
  hari: number;
  /** [nama, NIS, kemampuan dasar 0-100] */
  siswa: [string, string, number][];
  penilaian: Penilaian[];
  /** Nilai yang sengaja diatur agar cerita di halaman Dampak muncul (mis. siswa yang nilainya turun tajam). */
  khusus?: Record<string, Record<string, number>>;
}

const KUIS_BULAT = 'Kuis Operasi Bilangan Bulat';
const KUIS_PERBANDINGAN = 'Kuis Perbandingan';
const KUIS_LINEAR = 'Kuis Persamaan Linear';
const KUIS_POLA = 'Kuis Pola Bilangan';
const KUIS_FUNGSI = 'Kuis Relasi dan Fungsi';
const remedial = (judul: string) => `Remedial: ${judul}`;

const PENILAIAN_VII: Penilaian[] = [
  { jenis: 'Tugas', judul: 'Operasi Bilangan Bulat', hari: 70, geser: 4 },
  { jenis: 'UH', judul: KUIS_BULAT, hari: 63, geser: 0 },
  { jenis: 'Tugas', judul: 'Perbandingan', hari: 45, geser: 3 },
  { jenis: 'UH', judul: KUIS_PERBANDINGAN, hari: 38, geser: -2 },
  { jenis: 'Tugas', judul: 'Bentuk Aljabar', hari: 28, geser: 2 },
  { jenis: 'UTS', judul: 'ATS Ganjil', hari: 21, geser: -3 },
];

const KELAS: KelasDemo[] = [
  {
    kunci: 'VII A',
    tingkat: 'VII',
    rombel: 'A',
    kkm: 75,
    hari: 100,
    siswa: [
      ['Ahmad Fauzan', '2026001', 80],
      ['Bunga Citra', '2026002', 90],
      ['Dewi Lestari', '2026003', 86],
      ['Eko Prasetyo', '2026004', 70],
      ['Fitri Handayani', '2026005', 87],
      ['Galih Pratama', '2026006', 58],
      ['Hana Safitri', '2026007', 82],
      ['Ilham Maulana', '2026008', 74],
      ['Intan Permatasari', '2026009', 92],
      ['Joko Susilo', '2026010', 66],
      ['Kartika Sari', '2026011', 84],
      ['Lukman Hakim', '2026012', 77],
      ['Maya Anggraini', '2026013', 88],
      ['Nanda Saputra', '2026014', 72],
      ['Oktaviani Putri', '2026015', 79],
      ['Putra Wijaya', '2026016', 63],
      ['Qori Ramadhani', '2026017', 85],
      ['Rizky Aditya', '2026018', 75],
      ['Salsabila Zahra', '2026019', 94],
      ['Taufik Hidayat', '2026020', 69],
      ['Umi Kalsum', '2026021', 81],
      ['Vino Mahendra', '2026022', 61],
      ['Wulan Dari', '2026023', 83],
      ['Yusuf Alfarizi', '2026024', 78],
    ],
    penilaian: [...PENILAIAN_VII, { jenis: 'UH', judul: KUIS_LINEAR, hari: 9, geser: -1 }],
    // Dewi biasanya kuat, tapi anjlok di persamaan linear: muncul di daftar "perlu perhatian".
    khusus: { '2026003': { [KUIS_LINEAR]: 64 } },
  },
  {
    kunci: 'VII B',
    tingkat: 'VII',
    rombel: 'B',
    kkm: 75,
    hari: 100,
    siswa: [
      ['Adinda Puspita', '2026025', 84],
      ['Bagas Saputra', '2026026', 71],
      ['Cahya Ningrum', '2026027', 89],
      ['Dimas Anggara', '2026028', 65],
      ['Elsa Maharani', '2026029', 80],
      ['Farhan Ramadhan', '2026030', 76],
      ['Gita Savitri', '2026031', 91],
      ['Hendra Kurniawan', '2026032', 60],
      ['Indah Wulandari', '2026033', 86],
      ['Jihan Aulia', '2026034', 79],
      ['Kevin Santoso', '2026035', 68],
      ['Laila Nurhaliza', '2026036', 83],
      ['Muhammad Rafi', '2026037', 74],
      ['Nabila Azzahra', '2026038', 88],
      ['Oki Setiawan', '2026039', 62],
      ['Pramesti Ayu', '2026040', 81],
      ['Raka Firmansyah', '2026041', 70],
      ['Siti Nurjanah', '2026042', 85],
      ['Tegar Wicaksono', '2026043', 57],
      ['Vania Kirana', '2026044', 90],
      ['Wahyu Nugroho', '2026045', 73],
      ['Zaskia Amelia', '2026046', 82],
    ],
    penilaian: PENILAIAN_VII,
    khusus: { '2026034': { 'ATS Ganjil': 62 } },
  },
  {
    kunci: 'VIII A',
    tingkat: 'VIII',
    rombel: 'A',
    kkm: 78,
    hari: 98,
    siswa: [
      ['Alya Rahmawati', '2025001', 87],
      ['Bima Arya', '2025002', 72],
      ['Citra Kirana', '2025003', 90],
      ['Daffa Pratama', '2025004', 66],
      ['Erlangga Putra', '2025005', 79],
      ['Fadila Nur', '2025006', 84],
      ['Gilang Ramadhan', '2025007', 62],
      ['Hasna Khairunnisa', '2025008', 93],
      ['Irfan Hakim', '2025009', 75],
      ['Jessica Tanjung', '2025010', 81],
      ['Kurniawan Adi', '2025011', 69],
      ['Melati Suryani', '2025012', 85],
      ['Naufal Rizki', '2025013', 71],
      ['Putri Ayu Lestari', '2025014', 88],
      ['Rendi Saputra', '2025015', 59],
      ['Sekar Arum', '2025016', 80],
      ['Tiara Andini', '2025017', 83],
      ['Vicky Prasetya', '2025018', 76],
      ['Wina Marlina', '2025019', 74],
      ['Yoga Pratama', '2025020', 67],
    ],
    penilaian: [
      { jenis: 'Tugas', judul: 'Pola Bilangan', hari: 68, geser: 4 },
      { jenis: 'UH', judul: KUIS_POLA, hari: 59, geser: 0 },
      { jenis: 'Tugas', judul: 'Koordinat Kartesius', hari: 44, geser: 3 },
      { jenis: 'UTS', judul: 'ATS Ganjil', hari: 21, geser: -2 },
      { jenis: 'UH', judul: KUIS_FUNGSI, hari: 6, geser: 0 },
    ],
    khusus: { '2025012': { [KUIS_FUNGSI]: 68 } },
  },
];

/** Angka semu 0-1 yang tetap untuk kunci yang sama, supaya data demo selalu sama setiap disusun ulang. */
function acak(kunci: string): number {
  let h = 2166136261;
  for (let i = 0; i < kunci.length; i++) {
    h ^= kunci.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const batasi = (n: number) => Math.max(35, Math.min(100, Math.round(n)));
const nilaiSiswa = (nis: string, kemampuan: number, p: Penilaian) => batasi(kemampuan + p.geser + (acak(`${nis}|${p.judul}`) - 0.5) * 14);

// --- Bank soal ---------------------------------------------------------------------------------------------

interface ButirDemo {
  materi: string;
  tingkat: 'mudah' | 'sedang' | 'sulit';
  pertanyaan: string;
  pilihan: [string, string, string, string];
  kunci: number;
  pembahasan: string;
  ragu?: boolean;
}

interface SetDemo {
  judul: string;
  kelas: string;
  hari: number;
  butir: ButirDemo[];
  /** Kelas yang mengerjakan lewat Google Form, beserta persen benar per butir saat nilainya diimpor. */
  form?: { kelas: string; persen: number[]; hari: number };
  /** Set remedial: judul set asal; sasarannya siswa kelas form set asal yang nilainya di bawah KKM. */
  sumber?: string;
  /** Hari pengerjaan remedial; kosong = remedial sudah dibuat tetapi belum dikerjakan. */
  dikerjakan?: number;
}

const SET_SOAL: SetDemo[] = [
  {
    judul: KUIS_BULAT,
    kelas: 'VII',
    hari: 65,
    form: { kelas: 'VII A', persen: [92, 86, 75, 64, 55], hari: 63 },
    butir: [
      {
        materi: 'Penjumlahan dan pengurangan bilangan bulat',
        tingkat: 'mudah',
        pertanyaan: 'Hasil dari $-8 + 15 - (-3)$ adalah ...',
        pilihan: ['4', '10', '-4', '26'],
        kunci: 1,
        pembahasan: '$-8 + 15 = 7$. Mengurangi bilangan negatif sama dengan menambah lawannya: $7 - (-3) = 7 + 3 = 10$.',
      },
      {
        materi: 'Perkalian dan pembagian bilangan bulat',
        tingkat: 'mudah',
        pertanyaan: 'Hasil dari $(-6) \\times 4 : (-3)$ adalah ...',
        pilihan: ['-8', '-2', '8', '2'],
        kunci: 2,
        pembahasan: '$(-6) \\times 4 = -24$, lalu $-24 : (-3) = 8$ karena negatif dibagi negatif hasilnya positif.',
      },
      {
        materi: 'Masalah kontekstual bilangan bulat',
        tingkat: 'sedang',
        pertanyaan:
          'Suhu di puncak gunung pada pagi hari $-4^\\circ$C. Siang hari suhu naik $11^\\circ$C, lalu malam hari turun $9^\\circ$C. Suhu pada malam hari adalah ...',
        pilihan: ['$-2^\\circ$C', '$2^\\circ$C', '$-6^\\circ$C', '$16^\\circ$C'],
        kunci: 0,
        pembahasan: '$-4 + 11 - 9 = -2$, jadi suhu malam hari $-2^\\circ$C.',
      },
      {
        materi: 'Operasi pecahan',
        tingkat: 'sedang',
        pertanyaan: 'Hasil dari $\\frac{2}{3} + \\frac{3}{4}$ adalah ...',
        pilihan: ['$\\frac{5}{7}$', '$\\frac{5}{12}$', '$1\\frac{1}{12}$', '$1\\frac{5}{12}$'],
        kunci: 3,
        pembahasan: 'Samakan penyebut menjadi 12: $\\frac{8}{12} + \\frac{9}{12} = \\frac{17}{12} = 1\\frac{5}{12}$.',
      },
      {
        materi: 'Pecahan, desimal, dan persen',
        tingkat: 'sulit',
        pertanyaan:
          'Ibu membeli $2\\frac{1}{2}$ kg gula. Sebanyak $\\frac{3}{4}$ kg dipakai membuat kue dan $1,25$ kg dipakai membuat sirup. Sisa gula ibu adalah ...',
        pilihan: ['0,25 kg', '0,5 kg', '0,75 kg', '1 kg'],
        kunci: 1,
        pembahasan: 'Ubah ke desimal: $2,5 - 0,75 - 1,25 = 0,5$ kg.',
      },
    ],
  },
  {
    judul: KUIS_PERBANDINGAN,
    kelas: 'VII',
    hari: 40,
    form: { kelas: 'VII B', persen: [90, 77, 62, 54, 43], hari: 38 },
    butir: [
      {
        materi: 'Perbandingan senilai',
        tingkat: 'mudah',
        pertanyaan: 'Harga 3 buku tulis Rp12.000. Harga 7 buku tulis yang sama adalah ...',
        pilihan: ['Rp24.000', 'Rp28.000', 'Rp32.000', 'Rp36.000'],
        kunci: 1,
        pembahasan: 'Harga satu buku $12.000 : 3 = 4.000$, jadi 7 buku $7 \\times 4.000 = $ Rp28.000.',
      },
      {
        materi: 'Perbandingan senilai',
        tingkat: 'sedang',
        pertanyaan: 'Sebuah mobil menghabiskan 5 liter bensin untuk menempuh 60 km. Bensin yang diperlukan untuk menempuh 84 km adalah ...',
        pilihan: ['6 liter', '8 liter', '7 liter', '9 liter'],
        kunci: 2,
        pembahasan: 'Senilai: $\\frac{5}{60} = \\frac{x}{84}$, sehingga $x = \\frac{5 \\times 84}{60} = 7$ liter.',
      },
      {
        materi: 'Perbandingan berbalik nilai',
        tingkat: 'sedang',
        pertanyaan: 'Sebuah pekerjaan selesai dalam 12 hari oleh 6 pekerja. Jika dikerjakan oleh 8 pekerja, pekerjaan itu selesai dalam ...',
        pilihan: ['16 hari', '10 hari', '8 hari', '9 hari'],
        kunci: 3,
        pembahasan: 'Berbalik nilai: $6 \\times 12 = 8 \\times x$, sehingga $x = 72 : 8 = 9$ hari.',
      },
      {
        materi: 'Perbandingan berbalik nilai',
        tingkat: 'sedang',
        pertanyaan: 'Persediaan pakan cukup untuk 40 ekor ayam selama 15 hari. Jika ayam bertambah 10 ekor, persediaan itu cukup untuk ...',
        pilihan: ['12 hari', '10 hari', '18 hari', '20 hari'],
        kunci: 0,
        pembahasan: 'Ayam menjadi 50 ekor. $40 \\times 15 = 50 \\times x$, sehingga $x = 600 : 50 = 12$ hari.',
      },
      {
        materi: 'Skala',
        tingkat: 'sulit',
        pertanyaan: 'Jarak dua kota pada peta 6 cm. Skala peta $1 : 1.500.000$. Jarak sebenarnya kedua kota adalah ...',
        pilihan: ['9 km', '60 km', '90 km', '900 km'],
        kunci: 2,
        pembahasan: '$6 \\times 1.500.000 = 9.000.000$ cm $= 90$ km.',
      },
    ],
  },
  {
    judul: KUIS_LINEAR,
    kelas: 'VII',
    hari: 11,
    form: { kelas: 'VII A', persen: [91, 75, 58, 50, 38], hari: 9 },
    butir: [
      {
        materi: 'Persamaan linear: bentuk dasar',
        tingkat: 'mudah',
        pertanyaan: 'Nilai $x$ yang memenuhi persamaan $2x + 5 = 13$ adalah ...',
        pilihan: ['3', '4', '5', '9'],
        kunci: 1,
        pembahasan: 'Kurangkan 5 pada kedua ruas: $2x = 8$, lalu bagi 2 sehingga $x = 4$.',
      },
      {
        materi: 'Persamaan linear: dua langkah',
        tingkat: 'mudah',
        pertanyaan: 'Jika $3y - 7 = 11$, maka nilai $y$ adalah ...',
        pilihan: ['4', '5', '6', '7'],
        kunci: 2,
        pembahasan: 'Tambahkan 7: $3y = 18$, lalu bagi 3 sehingga $y = 6$.',
      },
      {
        materi: 'Persamaan linear: variabel di kedua ruas',
        tingkat: 'sedang',
        pertanyaan: 'Penyelesaian dari $5x - 4 = 2x + 11$ adalah ...',
        pilihan: ['$x = 15$', '$x = 3$', '$x = 7$', '$x = 5$'],
        kunci: 3,
        pembahasan: 'Kumpulkan variabel di ruas kiri: $5x - 2x = 11 + 4$, sehingga $3x = 15$ dan $x = 5$.',
      },
      {
        materi: 'Soal cerita persamaan linear',
        tingkat: 'sedang',
        pertanyaan: 'Umur Rani 4 tahun lebih tua dari adiknya. Jumlah umur mereka 20 tahun. Umur adik Rani adalah ...',
        pilihan: ['6 tahun', '8 tahun', '10 tahun', '12 tahun'],
        kunci: 1,
        pembahasan: 'Misal umur adik $a$: $a + (a + 4) = 20$, sehingga $2a = 16$ dan $a = 8$.',
      },
      {
        materi: 'Soal cerita persamaan linear',
        tingkat: 'sulit',
        pertanyaan: 'Keliling sebuah persegi panjang 46 cm. Panjangnya 5 cm lebih dari lebarnya. Lebar persegi panjang itu adalah ...',
        pilihan: ['9 cm', '8 cm', '14 cm', '18 cm'],
        kunci: 0,
        pembahasan: 'Misal lebar $l$, panjang $l + 5$. $2(l + 5 + l) = 46$, sehingga $2l + 5 = 23$ dan $l = 9$ cm.',
      },
    ],
  },
  {
    judul: remedial(KUIS_LINEAR),
    kelas: 'VII',
    hari: 7,
    sumber: KUIS_LINEAR,
    dikerjakan: 3,
    butir: [
      {
        materi: 'Persamaan linear: dua langkah',
        tingkat: 'mudah',
        pertanyaan: 'Nilai $x$ yang memenuhi $4x - 3 = 17$ adalah ...',
        pilihan: ['3', '4', '5', '6'],
        kunci: 2,
        pembahasan: 'Tambahkan 3: $4x = 20$, lalu bagi 4 sehingga $x = 5$.',
      },
      {
        materi: 'Persamaan linear: variabel di kedua ruas',
        tingkat: 'mudah',
        pertanyaan: 'Penyelesaian dari $7x + 2 = 3x + 18$ adalah ...',
        pilihan: ['$x = 2$', '$x = 4$', '$x = 5$', '$x = 16$'],
        kunci: 1,
        pembahasan: '$7x - 3x = 18 - 2$, sehingga $4x = 16$ dan $x = 4$.',
      },
      {
        materi: 'Soal cerita persamaan linear',
        tingkat: 'mudah',
        pertanyaan: 'Jumlah dua bilangan bulat berurutan adalah 37. Bilangan yang lebih kecil adalah ...',
        pilihan: ['16', '17', '18', '19'],
        kunci: 2,
        pembahasan: 'Misal bilangan terkecil $n$: $n + (n + 1) = 37$, sehingga $2n = 36$ dan $n = 18$.',
      },
      {
        materi: 'Soal cerita persamaan linear',
        tingkat: 'sedang',
        pertanyaan: 'Harga 2 pensil dan sebuah penghapus Rp9.000. Harga penghapus Rp3.000. Harga sebuah pensil adalah ...',
        pilihan: ['Rp2.500', 'Rp3.000', 'Rp4.500', 'Rp6.000'],
        kunci: 1,
        pembahasan: 'Misal harga pensil $p$: $2p + 3.000 = 9.000$, sehingga $2p = 6.000$ dan $p = $ Rp3.000.',
      },
    ],
  },
  {
    judul: KUIS_POLA,
    kelas: 'VIII',
    hari: 61,
    form: { kelas: 'VIII A', persen: [95, 85, 72, 65, 57], hari: 59 },
    butir: [
      {
        materi: 'Pola bilangan',
        tingkat: 'mudah',
        pertanyaan: 'Dua suku berikutnya dari barisan $3, 7, 11, 15, \\ldots$ adalah ...',
        pilihan: ['18, 21', '19, 23', '19, 24', '20, 25'],
        kunci: 1,
        pembahasan: 'Selisih tiap suku 4, jadi suku berikutnya $15 + 4 = 19$ dan $19 + 4 = 23$.',
      },
      {
        materi: 'Pola bilangan',
        tingkat: 'mudah',
        pertanyaan: 'Banyak noktah pada pola bilangan persegi ke-6 adalah ...',
        pilihan: ['12', '30', '36', '49'],
        kunci: 2,
        pembahasan: 'Pola bilangan persegi $U_n = n^2$, sehingga $U_6 = 6^2 = 36$.',
      },
      {
        materi: 'Barisan aritmetika',
        tingkat: 'sedang',
        pertanyaan: 'Suku ke-20 dari barisan $5, 8, 11, 14, \\ldots$ adalah ...',
        pilihan: ['62', '59', '65', '68'],
        kunci: 0,
        pembahasan: '$a = 5$, $b = 3$. $U_{20} = a + 19b = 5 + 57 = 62$.',
      },
      {
        materi: 'Rumus suku ke-n',
        tingkat: 'sedang',
        pertanyaan: 'Rumus suku ke-$n$ dari barisan $4, 9, 14, 19, \\ldots$ adalah ...',
        pilihan: ['$U_n = 5n + 4$', '$U_n = 4n + 5$', '$U_n = n + 5$', '$U_n = 5n - 1$'],
        kunci: 3,
        pembahasan: 'Beda 5, jadi $U_n = 5n + c$. Dari $U_1 = 4$: $5 + c = 4$, sehingga $c = -1$ dan $U_n = 5n - 1$.',
      },
      {
        materi: 'Soal cerita pola bilangan',
        tingkat: 'sulit',
        pertanyaan:
          'Kursi di gedung pertunjukan disusun bertingkat: baris pertama 12 kursi dan setiap baris berikutnya 2 kursi lebih banyak. Banyak kursi pada baris ke-15 adalah ...',
        pilihan: ['38', '40', '42', '44'],
        kunci: 1,
        pembahasan: '$U_{15} = 12 + (15 - 1) \\times 2 = 12 + 28 = 40$ kursi.',
      },
    ],
  },
  {
    judul: KUIS_FUNGSI,
    kelas: 'VIII',
    hari: 8,
    form: { kelas: 'VIII A', persen: [88, 79, 66, 48, 40], hari: 6 },
    butir: [
      {
        materi: 'Relasi',
        tingkat: 'mudah',
        pertanyaan:
          'Diketahui $A = \\{1, 2, 3\\}$ dan $B = \\{2, 4, 6\\}$. Relasi "setengah dari" dari $A$ ke $B$ dinyatakan dengan himpunan pasangan berurutan ...',
        pilihan: [
          '$\\{(2, 1), (4, 2), (6, 3)\\}$',
          '$\\{(1, 2), (2, 4), (3, 6)\\}$',
          '$\\{(1, 2), (2, 2), (3, 2)\\}$',
          '$\\{(1, 4), (2, 6), (3, 2)\\}$',
        ],
        kunci: 1,
        pembahasan: '1 setengah dari 2, 2 setengah dari 4, dan 3 setengah dari 6, jadi $\\{(1, 2), (2, 4), (3, 6)\\}$.',
      },
      {
        materi: 'Ciri fungsi',
        tingkat: 'mudah',
        pertanyaan: 'Himpunan pasangan berurutan berikut yang merupakan fungsi adalah ...',
        pilihan: [
          '$\\{(1, a), (1, b), (2, c)\\}$',
          '$\\{(1, a), (2, b), (2, c)\\}$',
          '$\\{(1, a), (2, a), (3, b)\\}$',
          '$\\{(1, a), (1, b), (1, c)\\}$',
        ],
        kunci: 2,
        pembahasan: 'Pada fungsi, setiap anggota daerah asal tepat punya satu pasangan. Hanya pilihan ketiga yang tidak mengulang anggota pertama.',
      },
      {
        materi: 'Nilai fungsi',
        tingkat: 'sedang',
        pertanyaan: 'Diketahui $f(x) = 3x - 5$. Nilai $f(4)$ adalah ...',
        pilihan: ['2', '7', '12', '17'],
        kunci: 1,
        pembahasan: '$f(4) = 3 \\times 4 - 5 = 12 - 5 = 7$.',
      },
      {
        materi: 'Nilai fungsi',
        tingkat: 'sedang',
        pertanyaan: 'Diketahui $f(x) = 2x + 3$ dan $f(a) = 15$. Nilai $a$ adalah ...',
        pilihan: ['5', '9', '33', '6'],
        kunci: 3,
        pembahasan: '$2a + 3 = 15$, sehingga $2a = 12$ dan $a = 6$.',
      },
      {
        materi: 'Rumus fungsi',
        tingkat: 'sulit',
        pertanyaan: 'Fungsi $f(x) = ax + b$ memiliki $f(1) = 5$ dan $f(3) = 11$. Rumus fungsi tersebut adalah ...',
        pilihan: ['$f(x) = 3x + 2$', '$f(x) = 2x + 3$', '$f(x) = 3x - 2$', '$f(x) = 6x - 1$'],
        kunci: 0,
        pembahasan: 'Kurangkan kedua persamaan: $(3a + b) - (a + b) = 11 - 5$, sehingga $a = 3$ dan $b = 5 - 3 = 2$.',
      },
    ],
  },
  {
    judul: remedial(KUIS_FUNGSI),
    kelas: 'VIII',
    hari: 2,
    sumber: KUIS_FUNGSI,
    butir: [
      {
        materi: 'Nilai fungsi',
        tingkat: 'mudah',
        pertanyaan: 'Diketahui $f(x) = 4x + 1$. Nilai $f(-2)$ adalah ...',
        pilihan: ['-9', '-7', '7', '9'],
        kunci: 1,
        pembahasan: '$f(-2) = 4 \\times (-2) + 1 = -8 + 1 = -7$.',
      },
      {
        materi: 'Nilai fungsi',
        tingkat: 'mudah',
        pertanyaan: 'Diketahui $f(x) = 5x - 2$ dan $f(a) = 18$. Nilai $a$ adalah ...',
        pilihan: ['2', '4', '16', '88'],
        kunci: 1,
        pembahasan: '$5a - 2 = 18$, sehingga $5a = 20$ dan $a = 4$.',
      },
      {
        materi: 'Rumus fungsi',
        tingkat: 'sedang',
        pertanyaan: 'Fungsi $f(x) = ax + b$ memiliki $f(2) = 7$ dan $f(5) = 16$. Rumus fungsi tersebut adalah ...',
        pilihan: ['$f(x) = 3x + 1$', '$f(x) = 2x + 3$', '$f(x) = 3x - 1$', '$f(x) = 9x - 11$'],
        kunci: 0,
        pembahasan: '$(5a + b) - (2a + b) = 16 - 7$, sehingga $3a = 9$, $a = 3$, dan $b = 7 - 6 = 1$.',
      },
    ],
  },
  {
    judul: PENANDA,
    kelas: 'VIII',
    hari: 1,
    butir: [
      {
        materi: 'Gradien',
        tingkat: 'mudah',
        pertanyaan: 'Gradien garis yang melalui titik $(1, 2)$ dan $(3, 8)$ adalah ...',
        pilihan: ['2', '3', '4', '6'],
        kunci: 1,
        pembahasan: '$m = \\frac{8 - 2}{3 - 1} = \\frac{6}{2} = 3$.',
      },
      {
        materi: 'Gradien',
        tingkat: 'sedang',
        pertanyaan: 'Gradien garis $2x + 4y - 8 = 0$ adalah ...',
        pilihan: ['$-2$', '$-\\frac{1}{2}$', '$\\frac{1}{2}$', '$2$'],
        kunci: 1,
        pembahasan: 'Ubah ke bentuk $y = mx + c$: $4y = -2x + 8$, sehingga $y = -\\frac{1}{2}x + 2$ dan $m = -\\frac{1}{2}$.',
      },
      {
        materi: 'Persamaan garis lurus',
        tingkat: 'sedang',
        pertanyaan: 'Persamaan garis yang melalui titik $(0, 3)$ dengan gradien 2 adalah ...',
        pilihan: ['$y = 3x + 2$', '$y = 2x - 3$', '$y = 2x + 3$', '$y = -2x + 3$'],
        kunci: 2,
        pembahasan: 'Titik $(0, 3)$ adalah titik potong sumbu-$y$, jadi $c = 3$ dan $y = 2x + 3$.',
      },
      // Kunci sengaja keliru (seharusnya pilihan pertama) dan ditandai ragu, untuk memperlihatkan pemeriksaan ulang AI.
      {
        materi: 'Persamaan garis lurus',
        tingkat: 'sulit',
        pertanyaan: 'Persamaan garis yang melalui titik $(2, 1)$ dan sejajar dengan garis $y = 3x - 4$ adalah ...',
        pilihan: ['$y = 3x - 5$', '$y = 3x + 5$', '$y = 3x - 7$', '$y = -3x + 7$'],
        kunci: 2,
        pembahasan: 'Sejajar berarti gradien sama, $m = 3$. $y - 1 = 3(x - 2)$, sehingga $y = 3x - 5$.',
        ragu: true,
      },
    ],
  },
];

// --- Penyusunan ----------------------------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;

/** Menghapus data lama akun demo lalu menyusun semuanya dari awal. Hanya beberapa kueri berkat createMany. */
async function susunDataDemo(tx: Tx, userId: string) {
  await tx.kelas.deleteMany({ where: { userId } });
  await tx.modul.deleteMany({ where: { userId } });
  await tx.setSoal.deleteMany({ where: { userId } });

  await tx.modul.createMany({ data: MODUL.map((m) => ({ ...m, userId })) });

  // Siswa per kelas: kunci kelas -> NIS -> { id, nilai per judul }.
  const kelasId = new Map<string, string>();
  const kkm = new Map<string, number>();
  const siswa = new Map<string, { id: string; nis: string; nilai: Map<string, number> }[]>();
  const dataKelas: Prisma.KelasCreateManyInput[] = [];
  const dataSiswa: Prisma.SiswaCreateManyInput[] = [];
  const dataNilai: Prisma.NilaiCreateManyInput[] = [];

  for (const k of KELAS) {
    const id = randomUUID();
    kelasId.set(k.kunci, id);
    kkm.set(k.kunci, k.kkm);
    dataKelas.push({
      id,
      userId,
      nama: namaKelasBaku(k.tingkat, null, k.rombel),
      tingkat: k.tingkat,
      rombel: k.rombel,
      tapel: TAPEL,
      kkm: k.kkm,
      createdAt: lalu(k.hari),
    });
    const daftar = k.siswa.map(([nama, nis, kemampuan]) => {
      const s = { id: randomUUID(), nis, nilai: new Map<string, number>() };
      dataSiswa.push({ id: s.id, kelasId: id, nama, nis });
      for (const p of k.penilaian) {
        const nilai = k.khusus?.[nis]?.[p.judul] ?? nilaiSiswa(nis, kemampuan, p);
        s.nilai.set(p.judul, nilai);
        dataNilai.push({ siswaId: s.id, mapel: MAPEL, jenis: p.jenis, judul: p.judul, nilai, tanggal: lalu(p.hari) });
      }
      return s;
    });
    siswa.set(k.kunci, daftar);
  }

  const dataSet: Prisma.SetSoalCreateManyInput[] = [];
  const dataButir: Prisma.ButirCreateManyInput[] = [];
  const setId = new Map<string, string>();
  const formKelas = new Map<string, string>();

  for (const s of SET_SOAL) {
    const id = randomUUID();
    setId.set(s.judul, id);
    const butir = s.butir.map((b, i) => ({ id: randomUUID(), setId: id, urutan: i + 1, ...b, ragu: b.ragu ?? false }));
    dataButir.push(...butir);

    const set: Prisma.SetSoalCreateManyInput = { id, userId, judul: s.judul, mapel: MAPEL, kelas: s.kelas, createdAt: lalu(s.hari) };
    if (s.form) {
      formKelas.set(s.judul, s.form.kelas);
      set.formKelasId = kelasId.get(s.form.kelas);
      set.analisis = butir.map((b, i) => ({ butirId: b.id, persenBenar: s.form!.persen[i] ?? null }));
      set.analisisAt = lalu(s.form.hari);
    }
    if (s.sumber) {
      // Sasaran remedial: siswa kelas yang mengerjakan set asal dengan nilai di bawah KKM.
      const kunciKelas = formKelas.get(s.sumber)!;
      const sasaran = siswa.get(kunciKelas)!.filter((sw) => (sw.nilai.get(s.sumber!) ?? 100) < kkm.get(kunciKelas)!);
      set.sumberId = setId.get(s.sumber);
      set.targetKelasId = kelasId.get(kunciKelas);
      set.targetSiswa = sasaran.map((sw) => sw.id);
      if (s.dikerjakan !== undefined) {
        for (const sw of sasaran) {
          const sebelum = sw.nilai.get(s.sumber)!;
          const sesudah = Math.min(100, sebelum + 7 + Math.round(acak(`${sw.nis}|${s.judul}`) * 15));
          dataNilai.push({ siswaId: sw.id, mapel: MAPEL, jenis: 'UH', judul: s.judul, nilai: sesudah, tanggal: lalu(s.dikerjakan) });
        }
      }
    }
    dataSet.push(set);
  }

  await tx.kelas.createMany({ data: dataKelas });
  await tx.siswa.createMany({ data: dataSiswa });
  await tx.nilai.createMany({ data: dataNilai });
  await tx.setSoal.createMany({ data: dataSet });
  await tx.butir.createMany({ data: dataButir });
}

// Akun demo bersama untuk juri dan pengunjung: dibuat sekali beserta data contoh lalu dipakai ulang.
// Passwordnya acak dan tidak dibagikan, jadi akun hanya bisa dimasuki lewat endpoint demo.
export async function siapkanAkunDemo() {
  const user = await prisma.user.upsert({
    where: { email: EMAIL_DEMO },
    create: {
      nama: 'Bu Siti (Akun Demo)',
      email: EMAIL_DEMO,
      passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
      sekolah: 'SMP Negeri Contoh',
      emailTerverifikasi: true,
    },
    update: {},
  });

  const terbaru = await prisma.setSoal.findFirst({ where: { userId: user.id, judul: PENANDA }, select: { id: true } });
  if (terbaru) return user;

  return prisma.$transaction(
    async (tx) => {
      // Kunci supaya dua permintaan demo bersamaan tidak menyusun data dua kali.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(724501)`;
      const sudah = await tx.setSoal.findFirst({ where: { userId: user.id, judul: PENANDA }, select: { id: true } });
      if (!sudah) await susunDataDemo(tx, user.id);
      // Akun demo versi lama masih berjenjang dan bermapel; akun sekarang bersifat umum.
      return tx.user.update({ where: { id: user.id }, data: { nama: 'Bu Siti (Akun Demo)', sekolah: 'SMP Negeri Contoh', jenjang: null, mapel: null } });
    },
    { maxWait: 10_000, timeout: 30_000 }
  );
}
