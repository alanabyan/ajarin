import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { generateModulAjar } from '../services/ai.service';

const generateSchema = z.object({
  judul: z.string().min(2),
  topik: z.string().min(2),
  jenjang: z.enum(['SD', 'SMP', 'SMA', 'SMK']),
  kelas: z.string().min(1),
  alokasiWaktu: z.string().min(1),
  kondisiKelas: z.string().optional(),
  tujuanPembelajaran: z.string().min(2),
});

export async function generate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = generateSchema.parse(req.body);
    const kontenDraf = await generateModulAjar(data);
    const modul = await prisma.modulAjar.create({
      data: {
        ...data,
        userId: req.userId!,
        kontenDraf,
      },
    });
    res.status(201).json({ modul });
  } catch (err) {
    next(err);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const modul = await prisma.modulAjar.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ modul });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const modul = await prisma.modulAjar.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!modul) return res.status(404).json({ error: 'Modul ajar tidak ditemukan.' });
    res.json({ modul });
  } catch (err) {
    next(err);
  }
}

const updateSchema = z.object({
  judul: z.string().min(2).optional(),
  kontenDraf: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'FINAL']).optional(),
});

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = updateSchema.parse(req.body);
    const existing = await prisma.modulAjar.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Modul ajar tidak ditemukan.' });
    const modul = await prisma.modulAjar.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ modul });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.modulAjar.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Modul ajar tidak ditemukan.' });
    await prisma.modulAjar.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
