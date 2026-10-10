import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from './auth';

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 20;

// Kuota dihitung dari dokumen hasil generate hari ini (modul + set soal), bukan dari memori
// proses, karena di serverless tiap request bisa jatuh ke instance berbeda.
export async function aiQuota(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sejak = new Date();
    sejak.setHours(0, 0, 0, 0);

    const [modul, soal] = await Promise.all([
      prisma.modulAjar.count({ where: { userId: req.userId, createdAt: { gte: sejak } } }),
      prisma.asesmenSet.count({ where: { userId: req.userId, createdAt: { gte: sejak } } }),
    ]);

    if (modul + soal >= DAILY_LIMIT) {
      return res.status(429).json({
        error: `Batas pembuatan dokumen AI harian (${DAILY_LIMIT}) sudah tercapai. Coba lagi besok.`,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}
