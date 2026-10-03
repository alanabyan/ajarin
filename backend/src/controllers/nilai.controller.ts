import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';

const nilaiSchema = z.object({
  siswaId: z.string().uuid(),
  mapel: z.string().trim().min(1),
  jenis: z.string().trim().min(1),
  nilai: z.number().min(0).max(100),
});

export async function createNilai(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = nilaiSchema.parse(req.body);
    const siswa = await prisma.siswa.findFirst({
      where: { id: data.siswaId, kelas: { userId: req.userId } },
    });
    if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    const nilai = await prisma.nilai.create({ data });
    res.status(201).json({ nilai });
  } catch (err) {
    next(err);
  }
}

// Input nilai satu kelas sekaligus (satu mapel + satu jenis, banyak siswa).
const batchSchema = z.object({
  kelasId: z.string().uuid(),
  mapel: z.string().trim().min(1),
  jenis: z.string().trim().min(1),
  items: z
    .array(
      z.object({
        siswaId: z.string().uuid(),
        nilai: z.number().min(0).max(100),
      })
    )
    .min(1)
    .max(200),
});

export async function createNilaiBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { kelasId, mapel, jenis, items } = batchSchema.parse(req.body);

    const kelas = await prisma.kelas.findFirst({
      where: { id: kelasId, userId: req.userId },
      select: { id: true },
    });
    if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });

    // Semua siswa harus anggota kelas ini.
    const idSiswa = Array.from(new Set(items.map((i) => i.siswaId)));
    const valid = await prisma.siswa.count({ where: { kelasId, id: { in: idSiswa } } });
    if (valid !== idSiswa.length) {
      return res.status(400).json({ error: 'Ada siswa yang bukan anggota kelas ini.' });
    }

    const hasil = await prisma.nilai.createMany({
      data: items.map((i) => ({ siswaId: i.siswaId, mapel, jenis, nilai: i.nilai })),
    });
    res.status(201).json({ jumlah: hasil.count });
  } catch (err) {
    next(err);
  }
}

export async function removeNilai(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const nilai = await prisma.nilai.findFirst({
      where: { id: req.params.id, siswa: { kelas: { userId: req.userId } } },
      select: { id: true },
    });
    if (!nilai) return res.status(404).json({ error: 'Nilai tidak ditemukan.' });
    await prisma.nilai.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function rekapByKelas(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const kelas = await prisma.kelas.findFirst({
      where: { id: req.params.kelasId, userId: req.userId },
      include: {
        siswa: {
          orderBy: { nama: 'asc' },
          include: { nilai: { orderBy: { tanggal: 'desc' } } },
        },
      },
    });
    if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });

    const rekap = kelas.siswa.map((s: (typeof kelas.siswa)[number]) => {
      const rataRata =
        s.nilai.length > 0
          ? s.nilai.reduce((sum: number, n: (typeof s.nilai)[number]) => sum + n.nilai, 0) / s.nilai.length
          : null;
      return {
        siswaId: s.id,
        nama: s.nama,
        nis: s.nis,
        jumlahNilai: s.nilai.length,
        rataRata,
        nilai: s.nilai,
      };
    });

    res.json({ kelas: { id: kelas.id, nama: kelas.nama, tapel: kelas.tapel }, rekap });
  } catch (err) {
    next(err);
  }
}