import { Router } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { HttpError, handle, uid } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { DataSet, hitungDampak } from '../services/dampak';

const router = Router();
router.use(requireAuth);

// Ringkasan dampak: tren, peta materi, siswa perlu perhatian, hasil remedial. Gabungan semua kelas,
// atau satu kelas saja dengan ?kelasId=.
router.get(
  '/',
  handle(async (req, res) => {
    const userId = uid(req);
    const { kelasId } = z.object({ kelasId: z.string().uuid().optional() }).parse(req.query);
    const [kelas, sets] = await Promise.all([
      prisma.kelas.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { siswa: { orderBy: { nama: 'asc' }, include: { nilai: true } } },
      }),
      prisma.setSoal.findMany({
        where: { userId },
        select: {
          id: true,
          judul: true,
          sumberId: true,
          formKelasId: true,
          targetKelasId: true,
          targetSiswa: true,
          analisis: true,
          butir: { select: { id: true, materi: true } },
        },
      }),
    ]);
    if (kelasId && !kelas.some((k) => k.id === kelasId)) throw new HttpError(404, 'Kelas tidak ditemukan.');
    res.json(hitungDampak(kelas, sets.map((s) => ({ ...s, analisis: s.analisis as DataSet['analisis'] })), kelasId));
  })
);

export default router;
