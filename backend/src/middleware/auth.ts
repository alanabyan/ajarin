import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
  }
  try {
    (req as Request & { userId: string }).userId = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.' });
  }
}
