import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const pesan = err.issues.map((i) => `${i.path.join('.') || 'data'}: ${i.message}`).join('; ');
    return res.status(400).json({ error: `Data tidak valid (${pesan})` });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
}
