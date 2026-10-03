import { Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import {
  MIME_GAMBAR,
  bacaCsv,
  bacaExcel,
  bacaFoto,
  buatTemplateExcel,
} from '../services/siswaImport.service';

// File disimpan di memori saja (tidak ditulis ke disk). Batas 3 MB karena foto dikirim ke AI
// sebagai base64 (batas permintaan Groq sekitar 4 MB); frontend memperkecil foto sebelum mengunggah.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } });

// Middleware unggah dengan pesan error berbahasa Indonesia.
export function unggahFile(req: AuthRequest, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const pesan = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 3 MB.' : 'Gagal mengunggah file.';
      return res.status(400).json({ error: pesan });
    }
    if (err) return next(err);
    next();
  });
}

// POST /siswa/import/parse  (multipart, field "file") -> pratinjau siswa, BELUM disimpan.
export async function parseImport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Pilih file terlebih dahulu.' });

    const nama = file.originalname.toLowerCase();
    let hasil;

    if (MIME_GAMBAR.includes(file.mimetype)) {
      hasil = await bacaFoto(file.buffer, file.mimetype);
    } else if (nama.endsWith('.xlsx')) {
      hasil = await bacaExcel(file.buffer);
    } else if (nama.endsWith('.csv') || file.mimetype === 'text/csv') {
      hasil = bacaCsv(file.buffer);
    } else if (nama.endsWith('.xls')) {
      return res.status(400).json({ error: 'Format .xls lama tidak didukung. Simpan sebagai .xlsx lalu coba lagi.' });
    } else {
      return res.status(400).json({ error: 'Format file tidak didukung. Gunakan .xlsx, .csv, atau foto JPG/PNG.' });
    }

    res.json(hasil);
  } catch (err) {
    next(err);
  }
}

const bulkSchema = z.object({
  kelasId: z.string().uuid(),
  siswa: z
    .array(
      z.object({
        nama: z.string().trim().min(2).max(100),
        nis: z.string().trim().max(30).optional().default(''),
      })
    )
    .min(1)
    .max(200),
});

function kunci(nama: string, nis: string): string {
  const n = nis.trim().toLowerCase();
  return n && n !== '-' ? `nis:${n}` : `nama:${nama.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

// POST /siswa/bulk  { kelasId, siswa: [{ nama, nis }] }
// Siswa yang sudah ada di kelas (NIS sama, atau nama sama bila NIS kosong) dilewati.
export async function bulkCreateSiswa(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { kelasId, siswa } = bulkSchema.parse(req.body);

    const kelas = await prisma.kelas.findFirst({ where: { id: kelasId, userId: req.userId }, select: { id: true } });
    if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });

    const ada = await prisma.siswa.findMany({ where: { kelasId }, select: { nama: true, nis: true } });
    const dipakai = new Set<string>(ada.map((s: { nama: string; nis: string }) => kunci(s.nama, s.nis)));

    const baru: { nama: string; nis: string; kelasId: string }[] = [];
    const dilewati: { nama: string; alasan: string }[] = [];

    for (const s of siswa) {
      const k = kunci(s.nama, s.nis);
      if (dipakai.has(k)) {
        dilewati.push({ nama: s.nama, alasan: 'Sudah ada di kelas ini' });
        continue;
      }
      dipakai.add(k);
      baru.push({ nama: s.nama, nis: s.nis || '-', kelasId });
    }

    let dibuat = 0;
    if (baru.length > 0) {
      const hasil = await prisma.siswa.createMany({ data: baru });
      dibuat = hasil.count;
    }

    res.status(201).json({ dibuat, dilewati });
  } catch (err) {
    next(err);
  }
}

// GET /siswa/template -> file Excel kosong untuk diisi guru.
export async function unduhTemplate(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workbook = await buatTemplateExcel();
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-siswa.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}