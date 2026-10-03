import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/db';
import { signToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';

const registerSchema = z.object({
  nama: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  jenjang: z.enum(['SD', 'SMP', 'SMA', 'SMK']),
  mapel: z.string().min(2),
  sekolah: z.string().optional(),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: 'Email sudah terdaftar.' });
    }
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { ...data, password: hashed },
    });
    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({
      token,
      user: { id: user.id, nama: user.nama, email: user.email, jenjang: user.jenjang, mapel: user.mapel },
    });
  } catch (err) {
    next(err);
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.status(401).json({ error: 'Email atau kata sandi salah.' });
    }
    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email atau kata sandi salah.' });
    }
    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, nama: user.nama, email: user.email, jenjang: user.jenjang, mapel: user.mapel },
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, nama: true, email: true, jenjang: true, mapel: true, sekolah: true },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
