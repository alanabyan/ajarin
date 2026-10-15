import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    // Pesan per kolom supaya formulir bisa menandai isian yang salah; kolom pertama yang gagal saja per nama.
    const kolom: Record<string, string> = {};
    for (const i of err.issues) {
      const k = i.path.join('.') || 'data';
      kolom[k] ??= i.message;
    }
    const ringkas = Object.values(kolom).slice(0, 3).join(' ');
    return res.status(400).json({ error: `Periksa kembali isian Anda. ${ringkas}`.trim(), kolom });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.detail });
  }
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
}
