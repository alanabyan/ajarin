import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { HttpError, handle, uid } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { simpanNilaiKelas } from '../services/nilai';
import { normNis } from '../utils/nis';
import { BarisRekap, excelRekap } from '../utils/excel';

const router = Router();
router.use(requireAuth);

async function milik(id: string, userId: string) {
  const kelas = await prisma.kelas.findFirst({ where: { id, userId } });
  if (!kelas) throw new HttpError(404, 'Kelas tidak ditemukan.');
  return kelas;
}

const kelasSchema = z.object({
  nama: z.string().trim().min(1).max(30),
  tapel: z.string().trim().min(4).max(20),
  kkm: z.number().int().min(0).max(100).default(75),
});

router.get(
  '/',
  handle(async (req, res) => {
    const daftar = await prisma.kelas.findMany({
      where: { userId: uid(req) },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { siswa: true } } },
    });
    res.json({
      kelas: daftar.map((k) => ({ id: k.id, nama: k.nama, tapel: k.tapel, kkm: k.kkm, jumlahSiswa: k._count.siswa })),
    });
  })
);

router.post(
  '/',
  handle(async (req, res) => {
    const kelas = await prisma.kelas.create({ data: { ...kelasSchema.parse(req.body), userId: uid(req) } });
    res.status(201).json({ kelas });
  })
);

router.patch(
  '/:id',
  handle(async (req, res) => {
    await milik(req.params.id, uid(req));
    const kelas = await prisma.kelas.update({ where: { id: req.params.id }, data: kelasSchema.partial().parse(req.body) });
    res.json({ kelas });
  })
);

router.delete(
  '/:id',
  handle(async (req, res) => {
    await milik(req.params.id, uid(req));
    await prisma.kelas.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

router.get(
  '/:id',
  handle(async (req, res) => {
    const kelas = await milik(req.params.id, uid(req));
    const siswa = await prisma.siswa.findMany({ where: { kelasId: kelas.id }, orderBy: { nama: 'asc' } });
    res.json({ kelas, siswa });
  })
);

// Tambah satu atau banyak siswa sekaligus (mis. hasil tempel dari spreadsheet). NIS yang sudah ada dilewati.
router.post(
  '/:id/siswa',
  handle(async (req, res) => {
    const kelas = await milik(req.params.id, uid(req));
    const { siswa } = z
      .object({
        siswa: z.array(z.object({ nama: z.string().trim().min(2).max(100), nis: z.string().trim().min(1).max(30) })).min(1).max(200),
      })
      .parse(req.body);

    const ada = new Set((await prisma.siswa.findMany({ where: { kelasId: kelas.id }, select: { nis: true } })).map((s) => normNis(s.nis)));
    const baru = siswa.filter((s) => {
      const kunci = normNis(s.nis);
      if (ada.has(kunci)) return false;
      ada.add(kunci);
      return true;
    });
    if (baru.length) await prisma.siswa.createMany({ data: baru.map((s) => ({ ...s, kelasId: kelas.id })) });
    res.status(201).json({ ditambahkan: baru.length, dilewati: siswa.length - baru.length });
  })
);

router.delete(
  '/siswa/:siswaId',
  handle(async (req, res) => {
    const siswa = await prisma.siswa.findFirst({ where: { id: req.params.siswaId, kelas: { userId: uid(req) } } });
    if (!siswa) throw new HttpError(404, 'Siswa tidak ditemukan.');
    await prisma.siswa.delete({ where: { id: siswa.id } });
    res.status(204).end();
  })
);

const nilaiSchema = z.object({
  jenis: z.enum(['Tugas', 'UH', 'UTS', 'UAS']),
  mapel: z.string().trim().min(1).max(80),
  judul: z.string().trim().max(100).default(''),
  items: z.array(z.object({ siswaId: z.string().uuid(), nilai: z.number().min(0).max(100) })).min(1).max(200),
});

// Input nilai manual satu kelas. Nilai yang sama (siswa + mapel + jenis + judul) diperbarui, bukan digandakan.
router.post(
  '/:id/nilai',
  handle(async (req, res) => {
    const { mapel, jenis, judul, items } = nilaiSchema.parse(req.body);
    res.status(201).json(await simpanNilaiKelas(req.params.id, uid(req), mapel, jenis, judul, items));
  })
);

router.delete(
  '/nilai/:nilaiId',
  handle(async (req, res) => {
    const nilai = await prisma.nilai.findFirst({ where: { id: req.params.nilaiId, siswa: { kelas: { userId: uid(req) } } } });
    if (!nilai) throw new HttpError(404, 'Nilai tidak ditemukan.');
    await prisma.nilai.delete({ where: { id: nilai.id } });
    res.status(204).end();
  })
);

const namaKolom = (n: { mapel: string; jenis: string; judul: string }) => `${n.jenis}${n.judul ? `: ${n.judul}` : ''} (${n.mapel})`;

async function hitungRekap(kelasId: string) {
  const siswa = await prisma.siswa.findMany({
    where: { kelasId },
    orderBy: { nama: 'asc' },
    include: { nilai: { orderBy: { tanggal: 'asc' } } },
  });
  const kolom = [...new Set(siswa.flatMap((s) => s.nilai.map(namaKolom)))];
  return { kolom, siswa };
}

// Rekap kelas: matriks nilai per penilaian, rata-rata, dan status ketuntasan terhadap KKM.
router.get(
  '/:id/rekap',
  handle(async (req, res) => {
    const kelas = await milik(req.params.id, uid(req));
    const { kolom, siswa } = await hitungRekap(kelas.id);

    const baris = siswa.map((s) => {
      const nilai: Record<string, number | null> = {};
      s.nilai.forEach((n) => (nilai[namaKolom(n)] = n.nilai));
      const rataRata = s.nilai.length ? s.nilai.reduce((t, n) => t + n.nilai, 0) / s.nilai.length : null;
      return {
        siswaId: s.id,
        nama: s.nama,
        nis: s.nis,
        nilai,
        rataRata,
        tuntas: rataRata === null ? null : rataRata >= kelas.kkm,
      };
    });

    const berNilai = baris.filter((b) => b.rataRata !== null);
    res.json({
      kelas: { id: kelas.id, nama: kelas.nama, tapel: kelas.tapel, kkm: kelas.kkm },
      kolom,
      baris,
      ringkasan: {
        jumlahSiswa: baris.length,
        rataKelas: berNilai.length ? berNilai.reduce((t, b) => t + b.rataRata!, 0) / berNilai.length : null,
        tuntas: baris.filter((b) => b.tuntas === true).length,
        remedial: baris.filter((b) => b.tuntas === false).length,
      },
    });
  })
);

router.get(
  '/:id/rekap/ekspor',
  handle(async (req, res) => {
    const kelas = await milik(req.params.id, uid(req));
    const { kolom, siswa } = await hitungRekap(kelas.id);
    const baris: BarisRekap[] = siswa.map((s) => {
      const nilai: Record<string, number | null> = {};
      s.nilai.forEach((n) => (nilai[namaKolom(n)] = n.nilai));
      const rataRata = s.nilai.length ? s.nilai.reduce((t, n) => t + n.nilai, 0) / s.nilai.length : null;
      return { nama: s.nama, nis: s.nis, nilai, rataRata, tuntas: rataRata === null ? null : rataRata >= kelas.kkm };
    });
    const wb = excelRekap(`Rekap Nilai Kelas ${kelas.nama} (${kelas.tapel})`, kelas.kkm, kolom, baris);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rekap-${kelas.nama.replace(/[^a-z0-9]+/gi, '-')}.xlsx"`);
    res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  })
);

// Rapor singkat satu siswa: perkembangan nilai, rata-rata per mata pelajaran, dan status terhadap KKM.
// Rata-rata kelas disertakan sebagai pembanding, tanpa peringkat siswa lain.
router.get(
  '/siswa/:siswaId/rapor',
  handle(async (req, res) => {
    const siswa = await prisma.siswa.findFirst({
      where: { id: req.params.siswaId, kelas: { userId: uid(req) } },
      include: { kelas: true, nilai: { orderBy: { tanggal: 'asc' } } },
    });
    if (!siswa) throw new HttpError(404, 'Siswa tidak ditemukan.');

    const rata = (daftar: number[]) => (daftar.length ? daftar.reduce((t, n) => t + n, 0) / daftar.length : null);

    const perMapel = new Map<string, number[]>();
    siswa.nilai.forEach((n) => perMapel.set(n.mapel, [...(perMapel.get(n.mapel) ?? []), n.nilai]));

    // Rata-rata kelas = rata-rata dari rata-rata tiap siswa yang sudah punya nilai.
    const semua = await prisma.nilai.findMany({
      where: { siswa: { kelasId: siswa.kelasId } },
      select: { siswaId: true, nilai: true },
    });
    const perSiswa = new Map<string, number[]>();
    semua.forEach((n) => perSiswa.set(n.siswaId, [...(perSiswa.get(n.siswaId) ?? []), n.nilai]));
    const rataKelas = rata([...perSiswa.values()].map((v) => rata(v)!));

    const rataRata = rata(siswa.nilai.map((n) => n.nilai));
    res.json({
      siswa: { id: siswa.id, nama: siswa.nama, nis: siswa.nis },
      kelas: { id: siswa.kelas.id, nama: siswa.kelas.nama, tapel: siswa.kelas.tapel, kkm: siswa.kelas.kkm },
      nilai: siswa.nilai.map((n) => ({ id: n.id, mapel: n.mapel, jenis: n.jenis, judul: n.judul, nilai: n.nilai, tanggal: n.tanggal })),
      perMapel: [...perMapel].map(([mapel, v]) => ({ mapel, rataRata: rata(v), jumlah: v.length })),
      rataRata,
      rataKelas,
      tuntas: rataRata === null ? null : rataRata >= siswa.kelas.kkm,
    });
  })
);

export default router;
