import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db';

export const EMAIL_DEMO = 'demo@pelitaguru.id';

const JUDUL_KUIS = 'Kuis Persamaan Linear';
const JUDUL_REMEDIAL = `Remedial: ${JUDUL_KUIS}`;

const HARI = 24 * 60 * 60 * 1000;
const lalu = (hari: number) => new Date(Date.now() - hari * HARI);

const MODUL = `## Identitas Modul
- Mata pelajaran: Matematika
- Jenjang / kelas: SMP / VII
- Alokasi waktu: 2 × 40 menit

## Tujuan Pembelajaran
Peserta didik mampu menyelesaikan persamaan linear satu variabel dan menerapkannya pada masalah sehari-hari.

## Pemahaman Bermakna
Persamaan membantu kita menemukan nilai yang belum diketahui dari informasi yang ada, misalnya harga satuan barang.

## Kegiatan Pendahuluan (10 menit)
- Guru mengajukan masalah kontekstual: harga 3 buku tulis ditambah sebuah pensil.
- Guru menggali pengetahuan awal tentang variabel dan operasi bilangan.

## Kegiatan Inti (55 menit)
- Mengamati contoh dan menyusun persamaan, misalnya $2x + 5 = 13$ (15 menit).
- Diskusi kelompok menyelesaikan tiga kartu masalah (25 menit).
- Presentasi dan tanggapan antar kelompok (15 menit).

## Kegiatan Penutup (15 menit)
- Refleksi dan penguatan konsep oleh guru.
- Kuis pendek 3 soal sebagai asesmen formatif.

## Asesmen dan Rubrik
Rubrik empat tingkat: belum tampak, mulai berkembang, berkembang sesuai harapan, sangat berkembang.

## Diferensiasi
- Siswa yang butuh bantuan: kartu langkah penyelesaian.
- Siswa mahir: soal cerita dua langkah.

## Refleksi Guru
Catat bagian yang sulit dipahami siswa dan strategi perbaikan untuk pertemuan berikutnya.
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
    await lengkapiDataDemo(ada.id);
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
      jenjang: 'SMP',
      mapel: 'Matematika',
      sekolah: 'SMP Negeri Contoh',
    },
  });

  const kelas = await prisma.kelas.create({ data: { userId: user.id, nama: '7A', tapel: '2026/2027', kkm: 75 } });
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
      judul: 'Persamaan Linear Satu Variabel',
      topik: 'Persamaan linear satu variabel',
      jenjang: 'SMP',
      kelas: 'VII',
      alokasiWaktu: '2 × 40 menit',
      tujuanPembelajaran: 'Menyelesaikan persamaan linear satu variabel dan menerapkannya pada masalah sehari-hari.',
      konten: MODUL,
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
