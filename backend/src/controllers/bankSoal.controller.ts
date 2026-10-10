import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { generateBankSoal } from '../services/ai.service';
import { buildSoalWorkbook } from '../utils/SoalWorkbook';
import { buildKahootWorkbook, normalisasiWaktu } from '../utils/kahootWorkbook';
import { buatGoogleFormKuis, ambilJawabanForm, tambahIdentitasForm } from '../utils/googleForms';

const generateSchema = z.object({
  judul: z.string().min(2),
  mapel: z.string().min(2),
  kelas: z.string().min(1),
  materi: z.string().min(2),
  tingkatKesulitan: z.enum(['mudah', 'sedang', 'sulit']),
  jumlahSoal: z.number().int().min(1).max(20),
});

export async function generate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = generateSchema.parse(req.body);
    const hasilSoal = await generateBankSoal(data);

    const asesmenSet = await prisma.asesmenSet.create({
      data: {
        userId: req.userId!,
        judul: data.judul,
        mapel: data.mapel,
        kelas: data.kelas,
        soal: {
          create: hasilSoal.map((s) => ({
            userId: req.userId!,
            materi: data.materi,
            tingkatKesulitan: data.tingkatKesulitan,
            pertanyaan: s.pertanyaan,
            pilihanJawaban: s.pilihanJawaban,
            kunciJawaban: s.kunciJawaban,
            pembahasan: s.pembahasan,
          })),
        },
      },
      include: { soal: true },
    });

    res.status(201).json({ asesmenSet });
  } catch (err) {
    next(err);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const asesmenSet = await prisma.asesmenSet.findMany({
      where: { userId: req.userId },
      include: { soal: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ asesmenSet });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const asesmenSet = await prisma.asesmenSet.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { soal: true },
    });
    if (!asesmenSet) return res.status(404).json({ error: 'Set soal tidak ditemukan.' });
    res.json({ asesmenSet });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.asesmenSet.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Set soal tidak ditemukan.' });
    await prisma.asesmenSet.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// Ekspor set soal ke Excel.
//   GET /bank-soal/:id/export                  -> format template impor Kahoot (default)
//   GET /bank-soal/:id/export?waktu=30         -> Kahoot dengan batas waktu 30 dtk (5/10/20/30/60/120)
//   GET /bank-soal/:id/export?format=lengkap   -> tabel lengkap + pembahasan (arsip/cetak)
// Rumus LaTeX diubah ke teks Unicode (utils/latexToText.ts) karena Excel/Kahoot tidak merender LaTeX.
// Kahoot tidak membuka API publik untuk membuat kuis otomatis, jadi unggah file tetap manual
// lewat Add question -> Import spreadsheet.
export async function exportXlsx(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const asesmenSet = await prisma.asesmenSet.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { soal: true },
    });
    if (!asesmenSet) return res.status(404).json({ error: 'Set soal tidak ditemukan.' });

    const lengkap = req.query.format === 'lengkap';
    const namaDasar = asesmenSet.judul.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'soal';

    let workbook: ReturnType<typeof buildSoalWorkbook>;
    let namaFile: string;

    if (lengkap) {
      workbook = buildSoalWorkbook(asesmenSet);
      namaFile = `${namaDasar}-lengkap`;
    } else {
      const hasil = buildKahootWorkbook(asesmenSet, normalisasiWaktu(req.query.waktu));
      workbook = hasil.workbook;
      namaFile = `${namaDasar}-kahoot`;
      // Jumlah soal yang melebihi batas karakter Kahoot (untuk peringatan di frontend).
      res.setHeader('X-Soal-Melebihi-Batas', String(hasil.melebihiBatas));
      res.setHeader('Access-Control-Expose-Headers', 'X-Soal-Melebihi-Batas, Content-Disposition');
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

// Buat Google Form (mode kuis) dari set soal, di Google Drive milik guru.
//   POST /bank-soal/:id/google-form   body: { accessToken }
// accessToken didapat di frontend lewat Google Identity Services (scope forms.body + drive.file),
// dipakai sekali untuk memanggil Google Forms API, dan TIDAK disimpan / di-log.
const googleFormSchema = z.object({ accessToken: z.string().min(20) });

export async function createGoogleForm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { accessToken } = googleFormSchema.parse(req.body);

    const asesmenSet = await prisma.asesmenSet.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { soal: true },
    });
    if (!asesmenSet) return res.status(404).json({ error: 'Set soal tidak ditemukan.' });

    const hasil = await buatGoogleFormKuis(asesmenSet, accessToken);

    // Simpan link supaya guru tahu set ini sudah pernah dibuatkan Google Form.
    // (Yang disimpan hanya link & id form, BUKAN token Google.) Kalau pembuatan ulang, link lama ditimpa;
    // form lama tetap ada di Google Drive guru.
    const dibuatPada = new Date();
    try {
      await prisma.asesmenSet.update({
        where: { id: asesmenSet.id },
        data: {
          googleFormId: hasil.formId,
          googleFormUrl: hasil.responderUri,
          googleFormEditUrl: hasil.editUrl,
          googleFormDibuatPada: dibuatPada,
        },
      });
    } catch (e) {
      // Form sudah terbuat di Google; jangan gagalkan respons hanya karena penyimpanan link gagal.
      console.error('Gagal menyimpan link Google Form:', e);
    }

    res.status(201).json({ ...hasil, dibuatPada });
  } catch (err) {
    next(err);
  }
}

// Ambil jawaban siswa dari Google Form set soal ini dan cocokkan ke siswa di satu kelas.
//   POST /bank-soal/:id/google-form/hasil   body: { accessToken, kelasId }
// Hanya pratinjau: tidak ada yang disimpan. Guru memeriksa hasilnya lalu menyimpannya lewat
// POST /nilai/batch. Pencocokan lewat NIS; kalau NIS tidak ada, lewat nama (tanpa beda huruf besar/kecil).
const hasilFormSchema = z.object({ accessToken: z.string().min(20), kelasId: z.string().uuid() });

const normNama = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export async function previewHasilGoogleForm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { accessToken, kelasId } = hasilFormSchema.parse(req.body);

    const asesmenSet = await prisma.asesmenSet.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { googleFormId: true },
    });
    if (!asesmenSet) return res.status(404).json({ error: 'Set soal tidak ditemukan.' });
    if (!asesmenSet.googleFormId) {
      return res.status(400).json({ error: 'Set soal ini belum dibuatkan Google Form.' });
    }

    const kelas = await prisma.kelas.findFirst({
      where: { id: kelasId, userId: req.userId },
      include: { siswa: true },
    });
    if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });

    const { jawaban, adaIdentitas } = await ambilJawabanForm(asesmenSet.googleFormId, accessToken);

    const perNis = new Map(kelas.siswa.map((s) => [s.nis.trim(), s]));
    const perNama = new Map(kelas.siswa.map((s) => [normNama(s.nama), s]));

    const hasil = jawaban.map((j) => {
      const siswa = (j.nis && perNis.get(j.nis)) || perNama.get(normNama(j.nama)) || null;
      return { nama: j.nama, nis: j.nis, skor: j.skor, waktu: j.waktu, siswaId: siswa?.id ?? null, namaSiswa: siswa?.nama ?? null };
    });

    // Dua jawaban yang cocok ke siswa yang sama (mis. NIS salah ketik) ditandai agar tidak tersimpan ganda.
    const dipakai = new Set<string>();
    for (const h of hasil) {
      if (!h.siswaId) continue;
      if (dipakai.has(h.siswaId)) {
        h.siswaId = null;
        h.namaSiswa = null;
      } else {
        dipakai.add(h.siswaId);
      }
    }

    res.json({ adaIdentitas, hasil });
  } catch (err) {
    next(err);
  }
}


// Tambahkan isian Nama/NIS ke Google Form yang sudah ada untuk set soal ini.
//   POST /bank-soal/:id/google-form/identitas   body: { accessToken }  (scope forms.body)
export async function tambahIdentitasGoogleForm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { accessToken } = googleFormSchema.parse(req.body);
    const asesmenSet = await prisma.asesmenSet.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { googleFormId: true },
    });
    if (!asesmenSet) return res.status(404).json({ error: 'Set soal tidak ditemukan.' });
    if (!asesmenSet.googleFormId) {
      return res.status(400).json({ error: 'Set soal ini belum dibuatkan Google Form.' });
    }
    res.json(await tambahIdentitasForm(asesmenSet.googleFormId, accessToken));
  } catch (err) {
    next(err);
  }
}
