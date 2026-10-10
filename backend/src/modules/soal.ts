import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { HttpError, handle, uid } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { aiLimiter, kuotaAI } from '../middleware/limits';
import { buatSoal } from '../services/ai';
import { ambilJawaban, buatKuis, perbaruiDaftarSiswa } from '../services/googleForms';
import { simpanNilaiKelas } from '../services/nilai';
import { bangunPilihan } from '../utils/pilihanSiswa';
import { excelKahoot, excelSoalLengkap, waktuKahootValid } from '../utils/excel';
import { wordSoal } from '../utils/word';

const router = Router();
router.use(requireAuth);

async function milik(id: string, userId: string) {
  const set = await prisma.setSoal.findFirst({
    where: { id, userId },
    include: { butir: { orderBy: { urutan: 'asc' } } },
  });
  if (!set) throw new HttpError(404, 'Set soal tidak ditemukan.');
  return set;
}

// Set remedial bisa ditujukan hanya untuk sebagian siswa. Dropdown nama di form, daftar "belum mengisi",
// dan penyegaran nama semuanya memakai daftar yang sama, supaya konsisten.
function siswaSasaran<T extends { id: string }>(set: { targetKelasId: string | null; targetSiswa: string[] }, kelasId: string, siswa: T[]): T[] {
  if (set.targetKelasId !== kelasId || set.targetSiswa.length === 0) return siswa;
  const sasaran = new Set(set.targetSiswa);
  return siswa.filter((s) => sasaran.has(s.id));
}

const buatSchema = z.object({
  judul: z.string().trim().min(2).max(150),
  mapel: z.string().trim().min(2).max(80),
  jenjang: z.enum(['SD', 'SMP', 'SMA', 'SMK']),
  kelas: z.string().trim().min(1).max(20),
  materi: z.string().trim().min(2).max(300),
  tingkat: z.enum(['mudah', 'sedang', 'sulit']),
  jumlah: z.number().int().min(1).max(20),
});

router.post(
  '/buat',
  aiLimiter,
  kuotaAI,
  handle(async (req, res) => {
    const { judul, ...input } = buatSchema.parse(req.body);
    const hasil = await buatSoal(input);
    const set = await prisma.setSoal.create({
      data: {
        userId: uid(req),
        judul,
        mapel: input.mapel,
        kelas: input.kelas,
        butir: {
          create: hasil.map((b, i) => ({
            urutan: i + 1,
            materi: input.materi,
            tingkat: input.tingkat,
            pertanyaan: b.pertanyaan,
            pilihan: b.pilihan,
            kunci: b.kunciIndex,
            pembahasan: b.pembahasan,
            ragu: b.ragu,
          })),
        },
      },
      include: { butir: { orderBy: { urutan: 'asc' } } },
    });
    res.status(201).json({ set });
  })
);

// Soal remedial: set baru dari soal-soal yang paling banyak dijawab salah (hasil analisis butir soal).
// Soal baru melatih konsep yang sama dengan angka dan konteks berbeda. Dihitung sebagai satu dokumen AI.
const remedialSchema = z.object({
  butirIds: z.array(z.string().uuid()).min(1).max(10),
  jumlah: z.number().int().min(3).max(20),
  // Bila diisi, set remedial hanya untuk siswa ini (mis. yang nilainya di bawah KKM) dan form-nya hanya memuat nama mereka.
  siswaIds: z.array(z.string().uuid()).max(200).optional(),
});

router.post(
  '/:id/remedial',
  aiLimiter,
  kuotaAI,
  handle(async (req, res) => {
    const { butirIds, jumlah, siswaIds } = remedialSchema.parse(req.body);
    const userId = uid(req);
    const set = await milik(req.params.id, userId);
    const lemah = set.butir.filter((b) => butirIds.includes(b.id));
    if (lemah.length === 0) throw new HttpError(400, 'Soal yang dipilih tidak ditemukan di set ini.');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { jenjang: true } });

    let sasaran: string[] = [];
    if (siswaIds?.length) {
      if (!set.formKelasId) throw new HttpError(400, 'Set soal ini belum dibuatkan Google Form, sehingga kelasnya tidak diketahui.');
      const sah = await prisma.siswa.findMany({
        where: { id: { in: siswaIds }, kelasId: set.formKelasId, kelas: { userId } },
        select: { id: true },
      });
      sasaran = sah.map((s) => s.id);
    }

    const materi = [...new Set(lemah.map((b) => b.materi))].join('; ');
    const hasil = await buatSoal({
      mapel: set.mapel,
      jenjang: user?.jenjang ?? 'SMP',
      kelas: set.kelas,
      materi,
      tingkat: 'mudah hingga sedang',
      jumlah,
      soalLemah: lemah.map((b) => b.pertanyaan),
    });

    const baru = await prisma.setSoal.create({
      data: {
        userId,
        judul: `Remedial: ${set.judul}`.slice(0, 150),
        mapel: set.mapel,
        kelas: set.kelas,
        sumberId: set.id,
        targetKelasId: sasaran.length ? set.formKelasId : null,
        targetSiswa: sasaran,
        butir: {
          create: hasil.map((b, i) => ({
            urutan: i + 1,
            materi,
            tingkat: 'mudah',
            pertanyaan: b.pertanyaan,
            pilihan: b.pilihan,
            kunci: b.kunciIndex,
            pembahasan: b.pembahasan,
            ragu: b.ragu,
          })),
        },
      },
    });
    res.status(201).json({ id: baru.id, jumlahSoal: hasil.length, jumlahSiswa: sasaran.length });
  })
);

router.get(
  '/',
  handle(async (req, res) => {
    const daftar = await prisma.setSoal.findMany({
      where: { userId: uid(req) },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { butir: true } } },
    });
    res.json({
      set: daftar.map((s) => ({
        id: s.id,
        judul: s.judul,
        mapel: s.mapel,
        kelas: s.kelas,
        jumlahSoal: s._count.butir,
        adaForm: Boolean(s.formId),
        createdAt: s.createdAt,
      })),
    });
  })
);

router.get(
  '/:id',
  handle(async (req, res) => {
    res.json({ set: await milik(req.params.id, uid(req)) });
  })
);

router.delete(
  '/:id',
  handle(async (req, res) => {
    await milik(req.params.id, uid(req));
    await prisma.setSoal.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

// Guru boleh mengoreksi soal hasil AI sebelum dibagikan.
const ubahButirSchema = z
  .object({
    pertanyaan: z.string().trim().min(5),
    pilihan: z.array(z.string().trim().min(1)).length(4),
    kunci: z.number().int().min(0).max(3),
    pembahasan: z.string().trim().min(1),
  })
  .refine((b) => new Set(b.pilihan).size === 4, { message: 'pilihan harus berbeda satu sama lain' });

router.put(
  '/:id/butir/:butirId',
  handle(async (req, res) => {
    const set = await milik(req.params.id, uid(req));
    if (set.formId) {
      throw new HttpError(409, 'Soal tidak bisa diubah setelah dibuatkan Google Form, karena form tidak ikut berubah.');
    }
    const data = ubahButirSchema.parse(req.body);
    const ada = set.butir.find((b) => b.id === req.params.butirId);
    if (!ada) throw new HttpError(404, 'Soal tidak ditemukan.');
    // Setelah guru memeriksa dan menyimpan, penanda ragu dihapus.
    const butir = await prisma.butir.update({ where: { id: ada.id }, data: { ...data, ragu: false } });
    res.json({ butir });
  })
);

router.get(
  '/:id/ekspor',
  handle(async (req, res) => {
    const set = await milik(req.params.id, uid(req));
    const dasar = set.judul.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'soal';
    let nama: string;
    let workbook;

    if (req.query.format === 'word') {
      const nama = `${dasar}-soal`;
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${nama}.docx"`);
      return void res.send(await wordSoal(set));
    }

    if (req.query.format === 'kahoot') {
      const hasil = excelKahoot(set, waktuKahootValid(req.query.waktu));
      workbook = hasil.workbook;
      nama = `${dasar}-kahoot`;
      res.setHeader('X-Soal-Melebihi-Batas', String(hasil.melebihiBatas));
    } else {
      workbook = excelSoalLengkap(set);
      nama = `${dasar}-lengkap`;
    }
    res.setHeader('Access-Control-Expose-Headers', 'X-Soal-Melebihi-Batas, Content-Disposition');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nama}.xlsx"`);
    res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  })
);

const tokenSchema = z.object({ accessToken: z.string().min(20) });

// Form dibuat untuk SATU kelas: dropdown "Pilih nama kamu" berisi siswa kelas itu, sehingga siswa cukup
// memilih namanya dan hasilnya pasti cocok dengan daftar kelas.
router.post(
  '/:id/google-form',
  handle(async (req, res) => {
    const { accessToken, kelasId } = tokenSchema.extend({ kelasId: z.string().uuid() }).parse(req.body);
    const userId = uid(req);
    const set = await milik(req.params.id, userId);
    const kelas = await prisma.kelas.findFirst({ where: { id: kelasId, userId }, include: { siswa: true } });
    if (!kelas) throw new HttpError(404, 'Kelas tidak ditemukan.');
    const peserta = siswaSasaran(set, kelas.id, kelas.siswa);
    if (peserta.length === 0) {
      throw new HttpError(400, 'Kelas ini belum punya siswa. Tambahkan siswa dulu agar bisa muncul di dropdown nama.');
    }

    const pilihan = bangunPilihan(peserta);
    const form = await buatKuis(
      { judul: set.judul, mapel: set.mapel, kelas: kelas.nama },
      set.butir.map((b) => ({
        id: b.id,
        pertanyaan: b.pertanyaan,
        pilihan: (b.pilihan as string[]) ?? [],
        kunci: b.kunci,
        pembahasan: b.pembahasan,
      })),
      Object.keys(pilihan),
      accessToken
    );

    // Hanya id, tautan, dan pemetaan pilihan yang disimpan, BUKAN token Google. Membuat ulang form menimpa
    // tautan lama (form lama tetap ada di Drive guru).
    await prisma.$transaction([
      prisma.setSoal.update({
        where: { id: set.id },
        data: {
          formId: form.formId,
          formUrl: form.responderUri,
          formEditUrl: form.editUrl,
          formKelasId: kelas.id,
          formSiswaQid: form.siswaQid,
          formPilihan: pilihan,
        },
      }),
      ...set.butir.map((b) =>
        prisma.butir.update({ where: { id: b.id }, data: { formQid: form.butirQid[b.id] ?? null } })
      ),
    ]);

    res.status(201).json({
      formUrl: form.responderUri,
      formEditUrl: form.editUrl,
      kelasId: kelas.id,
      jumlahSiswa: peserta.length,
      jumlahSoal: form.jumlahSoal,
      dilewati: form.dilewati,
      bisaDiisiSiapaSaja: form.bisaDiisiSiapaSaja,
    });
  })
);

// Segarkan isi dropdown nama dari daftar siswa kelas terkini (mis. setelah ada siswa pindahan).
// Pilihan lama tetap dikenali, jadi jawaban yang sudah masuk tidak hilang.
router.post(
  '/:id/google-form/daftar-siswa',
  handle(async (req, res) => {
    const { accessToken } = tokenSchema.parse(req.body);
    const userId = uid(req);
    const set = await milik(req.params.id, userId);
    if (!set.formId || !set.formSiswaQid || !set.formKelasId) {
      throw new HttpError(400, 'Set soal ini belum dibuatkan Google Form.');
    }
    const kelas = await prisma.kelas.findFirst({ where: { id: set.formKelasId, userId }, include: { siswa: true } });
    if (!kelas) throw new HttpError(404, 'Kelas untuk form ini sudah dihapus.');

    const peserta = siswaSasaran(set, kelas.id, kelas.siswa);
    const baru = bangunPilihan(peserta);
    await perbaruiDaftarSiswa(set.formId, set.formSiswaQid, Object.keys(baru), accessToken);
    const lama = (set.formPilihan as Record<string, string> | null) ?? {};
    await prisma.setSoal.update({ where: { id: set.id }, data: { formPilihan: { ...lama, ...baru } } });
    res.json({ jumlahSiswa: peserta.length });
  })
);

// Ambil jawaban dari Google Form: setiap jawaban sudah terhubung ke siswa lewat pilihan namanya.
// Hanya pratinjau: tidak ada yang tersimpan sampai guru memeriksa lalu memanggil /hasil/simpan.
router.post(
  '/:id/hasil/ambil',
  handle(async (req, res) => {
    const { accessToken } = tokenSchema.parse(req.body);
    const userId = uid(req);
    const set = await milik(req.params.id, userId);
    if (!set.formId || !set.formSiswaQid || !set.formKelasId) {
      throw new HttpError(400, 'Set soal ini belum dibuatkan Google Form.');
    }
    const kelas = await prisma.kelas.findFirst({ where: { id: set.formKelasId, userId }, include: { siswa: true } });
    if (!kelas) throw new HttpError(404, 'Kelas untuk form ini sudah dihapus.');

    const butirBernilai = set.butir.filter((b) => b.formQid);
    const { jawaban, tanpaNama } = await ambilJawaban(set.formId, set.formSiswaQid, butirBernilai.length, accessToken);

    const pemetaan = (set.formPilihan as Record<string, string> | null) ?? {};
    const peserta = siswaSasaran(set, kelas.id, kelas.siswa);
    const perId = new Map(peserta.map((s) => [s.id, s]));
    const sudah = new Set<string>();
    const hasil: { siswaId: string; nama: string; nis: string; skor: number; waktu: string }[] = [];
    let takDikenal = 0;

    for (const j of jawaban) {
      const siswa = perId.get(pemetaan[j.pilihan]);
      if (!siswa) {
        takDikenal++; // siswa sudah dihapus dari kelas
        continue;
      }
      // Dua pilihan bisa menunjuk siswa yang sama setelah daftar diperbarui; ambil yang terbaru.
      const ada = hasil.findIndex((h) => h.siswaId === siswa.id);
      if (ada >= 0) {
        if (j.waktu > hasil[ada].waktu) hasil[ada] = { siswaId: siswa.id, nama: siswa.nama, nis: siswa.nis, skor: j.skor, waktu: j.waktu };
        continue;
      }
      sudah.add(siswa.id);
      hasil.push({ siswaId: siswa.id, nama: siswa.nama, nis: siswa.nis, skor: j.skor, waktu: j.waktu });
    }
    hasil.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

    const analisis = butirBernilai.map((b) => {
      const dijawab = jawaban.filter((j) => b.formQid! in j.benar);
      const benar = dijawab.filter((j) => j.benar[b.formQid!]).length;
      return {
        butirId: b.id,
        urutan: b.urutan,
        pertanyaan: b.pertanyaan,
        materi: b.materi,
        persenBenar: dijawab.length ? Math.round((benar / dijawab.length) * 100) : null,
      };
    });

    res.json({
      hasil,
      belumMengisi: peserta
        .filter((s) => !sudah.has(s.id))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
        .map((s) => ({ siswaId: s.id, nama: s.nama, nis: s.nis })),
      analisis,
      takDikenal,
      tanpaNama,
      kelas: { id: kelas.id, nama: kelas.nama, kkm: kelas.kkm },
    });
  })
);

const simpanSchema = z.object({
  jenis: z.enum(['Tugas', 'UH', 'UTS', 'UAS']),
  mapel: z.string().trim().min(1).max(80),
  // Analisis butir dari pratinjau impor; disimpan sebagai dasar peta materi. Hanya butirId dan persen yang dipakai.
  analisis: z.array(z.object({ butirId: z.string().uuid(), persenBenar: z.number().min(0).max(100).nullable() })).max(200).optional(),
  items: z.array(z.object({ siswaId: z.string().uuid(), nilai: z.number().min(0).max(100) })).min(1).max(200),
});

router.post(
  '/:id/hasil/simpan',
  handle(async (req, res) => {
    const data = simpanSchema.parse(req.body);
    const userId = uid(req);
    const set = await milik(req.params.id, userId);
    if (!set.formKelasId) throw new HttpError(400, 'Set soal ini belum dibuatkan Google Form.');
    // Judul set dipakai sebagai judul penilaian, sehingga impor ulang memperbarui nilai yang sama.
    const hasil = await simpanNilaiKelas(set.formKelasId, userId, data.mapel, data.jenis, set.judul, data.items);

    // Snapshot analisis (hanya untuk butir milik set ini); impor ulang menimpa snapshot lama.
    if (data.analisis?.length) {
      const sah = new Set(set.butir.map((b) => b.id));
      const analisis = data.analisis.filter((a) => sah.has(a.butirId));
      if (analisis.length) await prisma.setSoal.update({ where: { id: set.id }, data: { analisis, analisisAt: new Date() } });
    }
    res.status(201).json(hasil);
  })
);

export default router;
