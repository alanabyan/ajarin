import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/db';
import { handle, uid } from '../lib/http';

const batas = (windowMs: number, limit: number, error: string) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error } });

export const authLimiter = batas(15 * 60 * 1000, 30, 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
export const aiLimiter = batas(60 * 1000, 6, 'Terlalu banyak permintaan AI. Tunggu sebentar lalu coba lagi.');

const BATAS_HARIAN = Number(process.env.AI_DAILY_LIMIT) || 20;

// Kuota harian dihitung dari dokumen yang dibuat hari ini (bukan memori proses),
// karena di serverless tiap request bisa mendarat di instance yang berbeda.
export const kuotaAI = handle(async (req: Request, res: Response, next: NextFunction) => {
  const sejak = new Date();
  sejak.setHours(0, 0, 0, 0);
  const userId = uid(req);
  const [modul, soal] = await Promise.all([
    prisma.modul.count({ where: { userId, createdAt: { gte: sejak } } }),
    prisma.setSoal.count({ where: { userId, createdAt: { gte: sejak } } }),
  ]);
  if (modul + soal >= BATAS_HARIAN) {
    return res.status(429).json({ error: `Batas pembuatan dokumen AI harian (${BATAS_HARIAN}) tercapai. Coba lagi besok.` });
  }
  next();
});
