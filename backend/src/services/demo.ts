import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db';

export const EMAIL_DEMO = 'demo@pelitaguru.id';

const JUDUL_KUIS = 'Kuis Persamaan Linear';
const JUDUL_REMEDIAL = `Remedial: ${JUDUL_KUIS}`;

const HARI = 24 * 60 * 60 * 1000;
const lalu = (hari: number) => new Date(Date.now() - hari * HARI);

const JUDUL_MODUL = 'Bilangan, Aljabar, dan Persamaan Linear';

// Modul ajar berformat rencana semester (RPS): tabel rencana per pertemuan untuk satu semester.
const MODUL = `## Identitas
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

const BUTIR = [
  {
    pertanyaan: 'Nilai $x$ yang memenuhi persamaan $2x + 5 = 13$ adalah ...',
    pilihan: ['3', '4', '5', '9'],
    kunci: 1,
    pembahasan: 'Kurangkan 5 pada kedua ruas: $2x = 8$, lalu bagi 2 sehingga $x = 4$.',
  },
  {
    pertanyaan: 'Jika $3y - 7 = 11$, maka nilai $y$ adalah ...',
    pilihan: ['4', '5', '6', '7'],
    kunci: 2,
    pembahasan: 'Tambahkan 7: $3y = 18$, lalu bagi 3 sehingga $y = 6$.',
  },
  {
    pertanyaan: 'Umur Rani 4 tahun lebih tua dari adiknya. Jumlah umur mereka 20 tahun. Umur adik Rani adalah ...',
    pilihan: ['6 tahun', '8 tahun', '10 tahun', '12 tahun'],
    kunci: 1,
    pembahasan: 'Misal umur adik $a$: $a + (a + 4) = 20$, sehingga $2a = 16$ dan $a = 8$.',
  },
];

// Materi per soal (urut): dasar untuk peta materi di halaman Dampak.
const MATERI_BUTIR = ['Persamaan linear: bentuk dasar', 'Persamaan linear: dua langkah', 'Soal cerita persamaan linear'];

const BUTIR_REMEDIAL = [
  {
    pertanyaan: 'Nilai $x$ yang memenuhi $4x - 3 = 17$ adalah ...',
    pilihan: ['3', '4', '5', '6'],
    kunci: 2,
    pembahasan: 'Tambahkan 3: $4x = 20$, lalu bagi 4 sehingga $x = 5$.',
  },
  {
    pertanyaan: 'Jika $5y + 2 = 27$, maka nilai $y$ adalah ...',
    pilihan: ['4', '5', '6', '7'],
    kunci: 1,
    pembahasan: 'Kurangkan 2: $5y = 25$, lalu bagi 5 sehingga $y = 5$.',
  },
  {
    pertanyaan: 'Jumlah dua bilangan bulat berurutan adalah 37. Bilangan terkecilnya adalah ...',
    pilihan: ['16', '17', '18', '19'],
    kunci: 2,
    pembahasan: 'Misal bilangan terkecil $n$: $n + (n + 1) = 37$, sehingga $2n = 36$ dan $n = 18$.',
  },
];

// Nilai tugas sebelumnya: dipakai untuk tren (Dewi sengaja turun tajam agar tampil di daftar perhatian).
const TUGAS: Record<string, number> = {
  '2026001': 78,
  '2026002': 85,
  '2026003': 90,
  '2026004': 74,
  '2026005': 90,
  '2026006': 61,
};

const SISWA: [string, string, number][] = [
  ['Ahmad Fauzan', '2026001', 82],
  ['Bunga Citra', '2026002', 91],
  ['Dewi Lestari', '2026003', 76],
  ['Eko Prasetyo', '2026004', 68],
  ['Fitri Handayani', '2026005', 88],
  ['Galih Pratama', '2026006', 54],
];

// Akun demo bersama untuk juri dan pengunjung: dibuat sekali beserta data contoh lalu dipakai ulang.
// Passwordnya acak dan tidak dibagikan, jadi akun hanya bisa dimasuki lewat endpoint demo.
export async function siapkanAkunDemo() {
  const ada = await prisma.user.findUnique({ where: { email: EMAIL_DEMO } });
  if (ada) {
    await perbaruiFormatDemo(ada.id);
    await lengkapiDataDemo(ada.id);
    // Akun demo versi lama masih berjenjang dan bermapel; akun sekarang bersifat umum.
    if (ada.jenjang || ada.mapel) return prisma.user.update({ where: { id: ada.id }, data: { jenjang: null, mapel: null } });
    return ada;
  }
  const user = await buatDataDasarDemo();
  await lengkapiDataDemo(user.id);
  return user;
}

async function buatDataDasarDemo() {
  const user = await prisma.user.create({
    data: {
      nama: 'Bu Siti (Akun Demo)',
      email: EMAIL_DEMO,
      passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
      sekolah: 'SMP Negeri Contoh',
      emailTerverifikasi: true,
    },
  });

  const kelas = await prisma.kelas.create({ data: { userId: user.id, nama: 'VII A', tingkat: 'VII', rombel: 'A', tapel: '2026/2027', kkm: 75 } });
  for (const [nama, nis, nilai] of SISWA) {
    await prisma.siswa.create({
      data: {
        kelasId: kelas.id,
        nama,
        nis,
        nilai: { create: [{ mapel: 'Matematika', jenis: 'UH', judul: JUDUL_KUIS, nilai, tanggal: lalu(7) }] },
      },
    });
  }

  await prisma.modul.create({
    data: {
      userId: user.id,
      ...DATA_MODUL,
    },
  });

  await prisma.setSoal.create({
    data: {
      userId: user.id,
      judul: JUDUL_KUIS,
      mapel: 'Matematika',
      kelas: 'VII',
      butir: {
        create: BUTIR.map((b, i) => ({ ...b, urutan: i + 1, materi: MATERI_BUTIR[i], tingkat: 'mudah' })),
      },
    },
  });

  return user;
}

const DATA_MODUL = {
  judul: JUDUL_MODUL,
  mapel: 'Matematika',
  topik: 'Bilangan bulat dan pecahan, perbandingan, bentuk aljabar, persamaan dan pertidaksamaan linear, aritmetika sosial',
  jenjang: 'SMP' as const,
  kelas: 'VII',
  semester: 'Ganjil',
  jumlahPertemuan: 16,
  alokasiWaktu: '2 JP × 40 menit per pertemuan',
  tujuanPembelajaran:
    'Peserta didik mampu mengoperasikan bilangan dan bentuk aljabar, menyelesaikan persamaan dan pertidaksamaan linear satu variabel, serta menerapkannya pada masalah sehari-hari.',
  konten: MODUL,
};

// Akun demo dari versi lama: kelas "7A" diganti nama baku "VII A" dan modul diganti format rencana semester.
async function perbaruiFormatDemo(userId: string) {
  await prisma.kelas.updateMany({ where: { userId, nama: '7A' }, data: { nama: 'VII A', tingkat: 'VII', rombel: 'A' } });
  await prisma.modul.updateMany({ where: { userId, semester: null }, data: DATA_MODUL });
  await prisma.modul.updateMany({ where: { userId, mapel: null }, data: { mapel: 'Matematika' } });
}

// Melengkapi data demo dengan riwayat yang dibutuhkan halaman Dampak: tugas sebelumnya, analisis soal, dan satu
// putaran remedial lengkap dengan hasilnya. Aman dijalankan berulang dan juga untuk akun demo yang dibuat versi lama.
async function lengkapiDataDemo(userId: string) {
  const sudah = await prisma.setSoal.findFirst({ where: { userId, judul: JUDUL_REMEDIAL }, select: { id: true } });
  if (sudah) return;

  const kelas = await prisma.kelas.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { siswa: true } });
  const kuis = await prisma.setSoal.findFirst({
    where: { userId, judul: JUDUL_KUIS },
    include: { butir: { orderBy: { urutan: 'asc' } } },
  });
  if (!kelas || !kuis) return;

  const siswa = new Map(kelas.siswa.map((s) => [s.nis, s]));
  const bawahKkm = kelas.siswa.filter((s) => s.nis === '2026004' || s.nis === '2026006'); // Eko 68 dan Galih 54
  const hasilRemedial: Record<string, number> = { '2026004': 80, '2026006': 72 };

  await prisma.$transaction(async (tx) => {
    // Versi lama memakai judul penilaian "Persamaan Linear"; harus sama dengan judul set agar remedial bisa dipasangkan.
    await tx.nilai.updateMany({
      where: { siswa: { kelasId: kelas.id }, judul: 'Persamaan Linear' },
      data: { judul: JUDUL_KUIS, tanggal: lalu(7) },
    });

    for (const [nis, nilai] of Object.entries(TUGAS)) {
      const s = siswa.get(nis);
      if (!s) continue;
      await tx.nilai.upsert({
        where: { siswaId_mapel_jenis_judul: { siswaId: s.id, mapel: 'Matematika', jenis: 'Tugas', judul: 'Operasi Bilangan' } },
        create: { siswaId: s.id, mapel: 'Matematika', jenis: 'Tugas', judul: 'Operasi Bilangan', nilai, tanggal: lalu(28) },
        update: {},
      });
    }

    await Promise.all(kuis.butir.map((b, i) => tx.butir.update({ where: { id: b.id }, data: { materi: MATERI_BUTIR[i] ?? b.materi } })));
    const persen = [88, 50, 33];
    await tx.setSoal.update({
      where: { id: kuis.id },
      data: {
        formKelasId: kelas.id,
        analisis: kuis.butir.map((b, i) => ({ butirId: b.id, persenBenar: persen[i] ?? null })),
        analisisAt: lalu(7),
      },
    });

    await tx.setSoal.create({
      data: {
        userId,
        judul: JUDUL_REMEDIAL,
        mapel: 'Matematika',
        kelas: 'VII',
        sumberId: kuis.id,
        targetKelasId: kelas.id,
        targetSiswa: bawahKkm.map((s) => s.id),
        butir: {
          create: BUTIR_REMEDIAL.map((b, i) => ({ ...b, urutan: i + 1, materi: MATERI_BUTIR.slice(1).join('; '), tingkat: 'mudah' })),
        },
      },
    });

    for (const s of bawahKkm) {
      await tx.nilai.create({
        data: { siswaId: s.id, mapel: 'Matematika', jenis: 'UH', judul: JUDUL_REMEDIAL, nilai: hasilRemedial[s.nis], tanggal: lalu(2) },
      });
    }
  });
}
