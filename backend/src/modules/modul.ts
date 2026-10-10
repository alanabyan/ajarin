import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { HttpError, handle, uid } from '../lib/http';
import { alirkanNdjson, putusBilaKlienPergi } from '../lib/ndjson';
import { requireAuth } from '../middleware/auth';
import { aiLimiter, kuotaAI } from '../middleware/limits';
import { alirModul, buatModul } from '../services/ai';
import { wordModul } from '../utils/word';

const router = Router();
router.use(requireAuth);

const buatSchema = z.object({
  judul: z.string().trim().min(2).max(150),
  topik: z.string().trim().min(2).max(200),
  mapel: z.string().trim().min(2).max(80),
  jenjang: z.enum(['SD', 'SMP', 'SMA', 'SMK']),
  kelas: z.string().trim().min(1).max(20),
  alokasiWaktu: z.string().trim().min(1).max(60),
  tujuanPembelajaran: z.string().trim().min(5).max(1500),
  kondisiKelas: z.string().trim().max(600).optional(),
});

type InputBuat = Omit<z.infer<typeof buatSchema>, 'judul'>;

function simpanModul(userId: string, judul: string, input: InputBuat, konten: string) {
  return prisma.modul.create({
    data: {
      userId,
      judul,
      topik: input.topik,
      jenjang: input.jenjang,
      kelas: input.kelas,
      alokasiWaktu: input.alokasiWaktu,
      tujuanPembelajaran: input.tujuanPembelajaran,
      kondisiKelas: input.kondisiKelas || null,
      konten,
    },
  });
}

router.post(
  '/buat',
  aiLimiter,
  kuotaAI,
  handle(async (req, res) => {
    const { judul, ...input } = buatSchema.parse(req.body);
    const konten = await buatModul(input);
    res.status(201).json({ modul: await simpanModul(uid(req), judul, input, konten) });
  })
);

// Versi streaming: teks modul dikirim bertahap sebagai baris JSON (NDJSON) supaya guru langsung melihat
// hasilnya dan koneksi tidak sepi selama AI menulis. Baris: {"t":"potongan"} ... lalu {"id":"..."} atau {"error":"..."}.
// Galat sebelum streaming dimulai (validasi, kuota, AI tidak bisa dihubungi) tetap berupa respons JSON biasa.
router.post(
  '/buat-stream',
  aiLimiter,
  kuotaAI,
  handle(async (req, res) => {
    const { judul, ...input } = buatSchema.parse(req.body);
    const userId = uid(req);

    const putus = putusBilaKlienPergi(res);
    const aliran = await alirModul(input, putus.signal);
    await alirkanNdjson(res, putus, aliran, async (konten) => simpanModul(userId, judul, input, konten));
  })
);

router.get(
  '/',
  handle(async (req, res) => {
    const modul = await prisma.modul.findMany({
      where: { userId: uid(req) },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, judul: true, topik: true, jenjang: true, kelas: true, alokasiWaktu: true, createdAt: true, updatedAt: true },
    });
    res.json({ modul });
  })
);

async function milik(id: string, userId: string) {
  const modul = await prisma.modul.findFirst({ where: { id, userId } });
  if (!modul) throw new HttpError(404, 'Modul ajar tidak ditemukan.');
  return modul;
}

router.get(
  '/:id',
  handle(async (req, res) => {
    res.json({ modul: await milik(req.params.id, uid(req)) });
  })
);

router.get(
  '/:id/ekspor',
  handle(async (req, res) => {
    const m = await milik(req.params.id, uid(req));
    const nama = m.judul.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'modul-ajar';
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nama}.docx"`);
    res.send(await wordModul(m));
  })
);

router.put(
  '/:id',
  handle(async (req, res) => {
    const data = z
      .object({ judul: z.string().trim().min(2).max(150).optional(), konten: z.string().min(1).max(60_000).optional() })
      .parse(req.body);
    await milik(req.params.id, uid(req));
    const modul = await prisma.modul.update({ where: { id: req.params.id }, data });
    res.json({ modul });
  })
);

router.delete(
  '/:id',
  handle(async (req, res) => {
    await milik(req.params.id, uid(req));
    await prisma.modul.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
