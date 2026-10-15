import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { HttpError, handle, uid } from '../lib/http';
import { alirkanNdjson, putusBilaKlienPergi } from '../lib/ndjson';
import { requireAuth } from '../middleware/auth';
import { aiLimiter, kuotaAI } from '../middleware/limits';
import { alirModul, buatModul, saranModul, type InputModul } from '../services/ai';
import { pastikanIsianSesuai } from '../services/validasiIsian';
import { JENJANG, KELAS_PER_JENJANG, MENIT_PER_JP, SEMUA_TINGKAT, kelasCocok } from '../utils/akademik';
import { rapikanRumus } from '../utils/rumus';
import { wordModul } from '../utils/word';

const router = Router();
router.use(requireAuth);

const teksBebas = /^[^<>{}]*$/;

const buatSchema = z.object({
  judul: z.string().trim().min(5).max(150).regex(teksBebas, 'Judul tidak boleh berisi < > { }.'),
  topik: z.string().trim().min(3).max(300),
  mapel: z.string().trim().min(2).max(80),
  jenjang: z.enum(JENJANG),
  kelas: z.enum(SEMUA_TINGKAT as [string, ...string[]], { errorMap: () => ({ message: 'Pilih kelas dari daftar.' }) }),
  semester: z.enum(['Ganjil', 'Genap']),
  jumlahPertemuan: z.number().int().min(4, 'Minimal 4 pertemuan.').max(24, 'Maksimal 24 pertemuan.'),
  jpPerPertemuan: z.number().int().min(1, 'Minimal 1 JP.').max(6, 'Maksimal 6 JP.'),
  tujuanPembelajaran: z.string().trim().min(15, 'Tulis tujuan pembelajaran minimal 15 karakter.').max(2000),
  kondisiKelas: z.string().trim().max(600).optional(),
  abaikanPeringatan: z.boolean().optional(),
});

const LABEL_MODUL = { judul: 'Judul modul', topik: 'Cakupan materi', tujuanPembelajaran: 'Tujuan pembelajaran', kondisiKelas: 'Kondisi kelas' };

type InputBuat = z.infer<typeof buatSchema>;

/** Validasi + pemeriksaan isian, lalu bahan prompt AI. */
async function siapkanInput(userId: string, body: unknown) {
  const input = buatSchema.parse(body);
  await pastikanIsianSesuai({
    jenis: 'modul',
    jenjang: input.jenjang,
    kelas: input.kelas,
    mapel: input.mapel,
    kolom: { judul: input.judul, topik: input.topik, tujuanPembelajaran: input.tujuanPembelajaran, kondisiKelas: input.kondisiKelas },
    label: LABEL_MODUL,
    abaikanPeringatan: input.abaikanPeringatan,
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { nama: true, sekolah: true } });
  const alokasiWaktu = `${input.jpPerPertemuan} JP × ${MENIT_PER_JP[input.jenjang]} menit per pertemuan`;
  const ai: InputModul = { ...input, alokasiWaktu, namaGuru: user?.nama, sekolah: user?.sekolah };
  return { input, ai };
}

function simpanModul(userId: string, input: InputBuat, alokasiWaktu: string, konten: string) {
  return prisma.modul.create({
    data: {
      userId,
      judul: input.judul,
      topik: input.topik,
      mapel: input.mapel,
      jenjang: input.jenjang,
      kelas: input.kelas,
      semester: input.semester,
      jumlahPertemuan: input.jumlahPertemuan,
      alokasiWaktu,
      tujuanPembelajaran: input.tujuanPembelajaran,
      kondisiKelas: input.kondisiKelas || null,
      konten: rapikanRumus(konten),
    },
  });
}

router.post(
  '/buat',
  aiLimiter,
  kuotaAI,
  handle(async (req, res) => {
    const { input, ai } = await siapkanInput(uid(req), req.body);
    const konten = await buatModul(ai);
    res.status(201).json({ modul: await simpanModul(uid(req), input, ai.alokasiWaktu, konten) });
  })
);

// Versi streaming: teks modul dikirim bertahap sebagai baris JSON (NDJSON) supaya guru langsung melihat
// hasilnya dan koneksi tidak sepi selama AI menulis. Baris: {"t":"potongan"} ... lalu {"id":"..."} atau {"error":"..."}.
// Galat sebelum streaming dimulai (validasi, pemeriksaan isian, kuota, AI tidak bisa dihubungi) tetap berupa respons JSON biasa.
router.post(
  '/buat-stream',
  aiLimiter,
  kuotaAI,
  handle(async (req, res) => {
    const userId = uid(req);
    const { input, ai } = await siapkanInput(userId, req.body);

    const putus = putusBilaKlienPergi(res);
    const aliran = await alirModul(ai, putus.signal);
    await alirkanNdjson(res, putus, aliran, async (konten) => simpanModul(userId, input, ai.alokasiWaktu, konten));
  })
);

// Saran cakupan materi dan TP untuk formulir Buat Modul. Tidak membuat dokumen, jadi tidak memakai kuota harian.
router.post(
  '/saran',
  aiLimiter,
  handle(async (req, res) => {
    const input = z
      .object({
        mapel: z.string().trim().min(2).max(80),
        jenjang: z.enum(JENJANG),
        kelas: z.enum(SEMUA_TINGKAT as [string, ...string[]], { errorMap: () => ({ message: 'Pilih kelas dulu.' }) }),
        semester: z.enum(['Ganjil', 'Genap']),
        jumlahPertemuan: z.number().int().min(4).max(24),
        topik: z.string().trim().max(300).optional(),
      })
      .parse(req.body);
    if (!kelasCocok(input.jenjang, input.kelas)) {
      throw new HttpError(400, `Kelas ${input.kelas} tidak ada di jenjang ${input.jenjang}.`, {
        kolom: { kelas: `Untuk ${input.jenjang}, pilih kelas ${KELAS_PER_JENJANG[input.jenjang].join(', ')}.` },
      });
    }
    res.json(await saranModul({ ...input, topik: input.topik || undefined }));
  })
);

router.get(
  '/',
  handle(async (req, res) => {
    const modul = await prisma.modul.findMany({
      where: { userId: uid(req) },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, judul: true, topik: true, mapel: true, jenjang: true, kelas: true, semester: true, jumlahPertemuan: true, alokasiWaktu: true, createdAt: true, updatedAt: true },
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
      .object({ judul: z.string().trim().min(5).max(150).optional(), konten: z.string().min(1).max(60_000).optional() })
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
