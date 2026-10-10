import rateLimit from 'express-rate-limit';

const pesan = (error: string) => ({ error });

// Batasi percobaan login/daftar per IP untuk meredam brute force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: pesan('Terlalu banyak percobaan. Coba lagi dalam beberapa menit.'),
});

// Batasi laju endpoint AI per IP; kuota harian per akun ada di aiQuota.
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: pesan('Terlalu banyak permintaan AI. Tunggu sebentar lalu coba lagi.'),
});
