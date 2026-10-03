// Seed data supaya bisa langsung login dan mencoba fitur tanpa mendaftar manual.
// Jalankan dengan: npx prisma db seed   (atau otomatis setelah `prisma migrate dev`)

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'guru@ajarin.test';
const DEMO_PASSWORD = 'password123';

async function main() {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      nama: 'Bu Siti Rahayu',
      email: DEMO_EMAIL,
      password: hashed,
      jenjang: 'SMP',
      mapel: 'Matematika',
      sekolah: 'SMP Negeri 1 Contoh',
    },
  });

  let kelas = await prisma.kelas.findFirst({
    where: { userId: user.id, nama: '8B', tapel: '2026/2027' },
  });

  if (!kelas) {
    kelas = await prisma.kelas.create({
      data: { nama: '8B', tapel: '2026/2027', userId: user.id },
    });

    const daftarSiswa = [
      { nama: 'Ahmad Fauzan', nis: '2026001' },
      { nama: 'Bunga Citra', nis: '2026002' },
      { nama: 'Dewi Lestari', nis: '2026003' },
      { nama: 'Eko Prasetyo', nis: '2026004' },
    ];

    for (const s of daftarSiswa) {
      await prisma.siswa.create({ data: { ...s, kelasId: kelas.id } });
    }

    // Sedikit nilai contoh supaya rekap di halaman Kelas & Nilai tidak kosong.
    const siswaBaru = await prisma.siswa.findMany({ where: { kelasId: kelas.id } });
    for (const s of siswaBaru) {
      await prisma.nilai.create({
        data: { siswaId: s.id, mapel: 'Matematika', jenis: 'Tugas', nilai: 75 + Math.floor(Math.random() * 20) },
      });
    }
  }

  console.log('Seed selesai.\n');
  console.log('Login dengan:');
  console.log(`  Email      : ${DEMO_EMAIL}`);
  console.log(`  Kata sandi : ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
