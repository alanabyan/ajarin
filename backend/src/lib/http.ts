import { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Membungkus handler async supaya error otomatis diteruskan ke error handler.
export const handle =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

// Id user dari token (diisi oleh middleware requireAuth).
export const uid = (req: Request): string => (req as Request & { userId: string }).userId;
