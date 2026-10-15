import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { HttpError, handle, uid } from '../lib/http';
import { signToken } from '../lib/jwt';
import { authLimiter, kirimUlangLimiter } from '../middleware/limits';
import { requireAuth } from '../middleware/auth';
import { siapkanAkunDemo } from '../services/demo';
import { kirimEmailVerifikasi } from '../services/email';

const router = Router();

const BERLAKU_TOKEN = 24 * 60 * 60 * 1000;

// Batas panjang isian akun; frontend memakai angka yang sama (src/pages/Akun.tsx).
export const BATAS = { nama: 30, email: 100, sekolah: 30 };

const namaSchema = z
  .string()
  .trim()
  .min(2)
  .max(BATAS.nama)
  .regex(/^[\p{L} .,'-]+$/u, 'Nama hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.');

// Nama sekolah opsional; kosong disimpan sebagai null.
const sekolahSchema = z
  .string()
  .trim()
  .max(BATAS.sekolah)
  .regex(/^[\p{L}0-9 .,'()/&-]*$/u, 'Nama sekolah mengandung karakter yang tidak diizinkan.')
  .optional()
  .transform((s) => s || null);

// Daftar bersifat umum: tanpa jenjang dan mata pelajaran.
const daftarSchema = z.object({
  nama: namaSchema,
  email: z.string().trim().toLowerCase().email().max(BATAS.email),
  password: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter.')
    .max(72, 'Kata sandi maksimal 72 karakter.')
    .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
    .regex(/[0-9]/, 'Kata sandi harus mengandung angka.'),
  sekolah: sekolahSchema,
});

const publik = (u: { id: string; nama: string; email: string; jenjang: string | null; mapel: string | null; sekolah: string | null }) => ({
  id: u.id,
  nama: u.nama,
  email: u.email,
  jenjang: u.jenjang,
  mapel: u.mapel,
  sekolah: u.sekolah,
});

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Token acak baru: yang asli dikirim lewat email, yang disimpan hanya hash-nya. */
function tokenBaru() {
  const token = randomBytes(32).toString('hex');
  return { token, data: { tokenVerifikasi: hashToken(token), tokenKedaluwarsa: new Date(Date.now() + BERLAKU_TOKEN) } };
}

const BELUM_VERIFIKASI = { kode: 'BELUM_VERIFIKASI' };

// Daftar tidak langsung memberi sesi: akun baru harus memverifikasi email dulu, lalu masuk dari halaman masuk.
router.post(
  '/daftar',
  authLimiter,
  handle(async (req, res) => {
    const { password, ...data } = daftarSchema.parse(req.body);
    const ada = await prisma.user.findUnique({ where: { email: data.email } });
    if (ada) {
      if (!ada.emailTerverifikasi) {
        throw new HttpError(409, 'Email ini sudah terdaftar tetapi belum diverifikasi. Kirim ulang tautan verifikasi dari halaman masuk.', {
          ...BELUM_VERIFIKASI,
          kolom: { email: 'Email sudah terdaftar, belum diverifikasi.' },
        });
      }
      throw new HttpError(409, 'Email sudah terdaftar. Silakan masuk.', { kolom: { email: 'Email sudah terdaftar.' } });
    }
    const { token, data: dataToken } = tokenBaru();
    const user = await prisma.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 10), ...dataToken },
    });
    try {
      await kirimEmailVerifikasi(user.email, user.nama, token);
    } catch (err) {
      // Email gagal terkirim: akun dibatalkan supaya guru bisa mendaftar ulang dengan email yang sama.
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      if (err instanceof HttpError) throw err;
      console.error('Gagal mengirim email verifikasi:', (err as Error).message);
      throw new HttpError(502, 'Email verifikasi gagal dikirim. Periksa alamat email Anda lalu coba lagi.');
    }
    res.status(201).json({ email: user.email });
  })
);

router.post(
  '/verifikasi',
  authLimiter,
  handle(async (req, res) => {
    const { token } = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/, 'Tautan verifikasi tidak valid.') }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { tokenVerifikasi: hashToken(token) } });
    if (!user) throw new HttpError(400, 'Tautan verifikasi tidak valid atau sudah dipakai. Bila email Anda sudah terverifikasi, silakan masuk.');
    if (!user.tokenKedaluwarsa || user.tokenKedaluwarsa < new Date()) {
      throw new HttpError(400, 'Tautan verifikasi sudah kedaluwarsa. Minta tautan baru dari halaman masuk.', { kode: 'KEDALUWARSA', email: user.email });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { emailTerverifikasi: true, tokenVerifikasi: null, tokenKedaluwarsa: null },
    });
    res.json({ email: user.email });
  })
);

// Jawaban selalu sama supaya endpoint ini tidak bisa dipakai menebak email mana yang terdaftar.
router.post(
  '/kirim-ulang',
  kirimUlangLimiter,
  handle(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailTerverifikasi) {
      const { token, data } = tokenBaru();
      await prisma.user.update({ where: { id: user.id }, data });
      try {
        await kirimEmailVerifikasi(user.email, user.nama, token);
      } catch (err) {
        if (err instanceof HttpError) throw err;
        console.error('Gagal mengirim ulang email verifikasi:', (err as Error).message);
        throw new HttpError(502, 'Email verifikasi gagal dikirim. Coba lagi sebentar.');
      }
    }
    res.json({ pesan: 'Bila email tersebut terdaftar dan belum diverifikasi, tautan baru sudah dikirim. Periksa juga folder Spam.' });
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
    if (!user.emailTerverifikasi) {
      throw new HttpError(403, 'Email Anda belum diverifikasi. Buka tautan yang kami kirim ke email Anda, atau kirim ulang tautannya.', BELUM_VERIFIKASI);
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

// Ubah profil: nama dan nama sekolah. Email tidak bisa diubah di sini karena dipakai untuk masuk dan sudah diverifikasi.
router.patch(
  '/saya',
  requireAuth,
  handle(async (req, res) => {
    const data = z.object({ nama: namaSchema.optional(), sekolah: sekolahSchema }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: uid(req) },
      data: { ...(data.nama ? { nama: data.nama } : {}), ...('sekolah' in req.body ? { sekolah: data.sekolah } : {}) },
    });
    res.json({ user: publik(user) });
  })
);

export default router;
