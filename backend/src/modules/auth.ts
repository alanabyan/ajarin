import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { HttpError, handle, uid } from '../lib/http';
import { signToken } from '../lib/jwt';
import { authLimiter } from '../middleware/limits';
import { requireAuth } from '../middleware/auth';
import { siapkanAkunDemo } from '../services/demo';

const router = Router();

const daftarSchema = z.object({
  nama: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'minimal 8 karakter'),
  jenjang: z.enum(['SD', 'SMP', 'SMA', 'SMK']),
  mapel: z.string().trim().min(2),
  sekolah: z.string().trim().optional(),
});

const publik = (u: { id: string; nama: string; email: string; jenjang: string; mapel: string; sekolah: string | null }) => ({
  id: u.id,
  nama: u.nama,
  email: u.email,
  jenjang: u.jenjang,
  mapel: u.mapel,
  sekolah: u.sekolah,
});

router.post(
  '/daftar',
  authLimiter,
  handle(async (req, res) => {
    const { password, ...data } = daftarSchema.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: data.email } })) {
      throw new HttpError(409, 'Email sudah terdaftar.');
    }
    const user = await prisma.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
    res.status(201).json({ token: signToken(user.id), user: publik(user) });
  })
);

router.post(
  '/masuk',
  authLimiter,
  handle(async (req, res) => {
    const { email, password } = z
      .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, 'Email atau kata sandi salah.');
    }
    res.json({ token: signToken(user.id), user: publik(user) });
  })
);

// Masuk sebagai akun demo bersama (tanpa daftar), berisi data contoh. Untuk juri dan pengunjung.
router.post(
  '/demo',
  authLimiter,
  handle(async (_req, res) => {
    const user = await siapkanAkunDemo();
    res.json({ token: signToken(user.id), user: publik(user) });
  })
);

router.get(
  '/saya',
  requireAuth,
  handle(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: uid(req) } });
    if (!user) throw new HttpError(401, 'Akun tidak ditemukan.');
    res.json({ user: publik(user) });
  })
);

export default router;
