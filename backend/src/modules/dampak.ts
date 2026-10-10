import { Router } from 'express';
import { prisma } from '../lib/db';
import { handle, uid } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { DataSet, hitungDampak } from '../services/dampak';

const router = Router();
router.use(requireAuth);

// Ringkasan dampak seluruh kelas dan set soal milik guru: tren, peta materi, siswa perlu perhatian, hasil remedial.
router.get(
  '/',
  handle(async (req, res) => {
    const userId = uid(req);
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
          targetKelasId: true,
          targetSiswa: true,
          analisis: true,
          butir: { select: { id: true, materi: true } },
        },
      }),
    ]);
    res.json(hitungDampak(kelas, sets.map((s) => ({ ...s, analisis: s.analisis as DataSet['analisis'] }))));
  })
);

export default router;
