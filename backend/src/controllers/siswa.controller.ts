import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';

const kelasSchema = z.object({
  nama: z.string().trim().min(1),
  tapel: z.string().trim().min(4),
});

export async function createKelas(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = kelasSchema.parse(req.body);
    const kelas = await prisma.kelas.create({ data: { ...data, userId: req.userId! } });
    res.status(201).json({ kelas });
  } catch (err) {
    next(err);
  }
}

export async function listKelas(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const kelas = await prisma.kelas.findMany({
      where: { userId: req.userId },
      include: { siswa: { orderBy: { nama: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ kelas });
  } catch (err) {
    next(err);
  }
}

// Hapus kelas. Siswa dan seluruh nilainya ikut terhapus (onDelete: Cascade di schema.prisma).
export async function removeKelas(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const kelas = await prisma.kelas.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
    await prisma.kelas.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

const siswaSchema = z.object({
  nama: z.string().trim().min(2),
  nis: z.string().trim().min(1),
  kelasId: z.string().uuid(),
});

export async function createSiswa(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = siswaSchema.parse(req.body);
    const kelas = await prisma.kelas.findFirst({ where: { id: data.kelasId, userId: req.userId } });
    if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
    const siswa = await prisma.siswa.create({ data });
    res.status(201).json({ siswa });
  } catch (err) {
    next(err);
  }
}

export async function removeSiswa(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const siswa = await prisma.siswa.findFirst({
      where: { id: req.params.id, kelas: { userId: req.userId } },
    });
    if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    await prisma.siswa.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}