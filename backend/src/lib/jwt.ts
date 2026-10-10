import jwt from 'jsonwebtoken';

const secret = (): string => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET belum diatur di .env');
  return s;
};

export const signToken = (userId: string): string => jwt.sign({ sub: userId }, secret(), { expiresIn: '7d' });

export const verifyToken = (token: string): string => {
  const payload = jwt.verify(token, secret());
  if (typeof payload === 'string' || !payload.sub) throw new Error('Token tidak valid');
  return payload.sub;
};
