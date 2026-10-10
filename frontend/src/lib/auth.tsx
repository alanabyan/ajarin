import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { offline } from './api';
import type { Jenjang, User } from '../types';

export interface DataDaftar {
  nama: string;
  email: string;
  password: string;
  jenjang: Jenjang;
  mapel: string;
  sekolah?: string;
}

interface AuthValue {
  user: User | null;
  memuat: boolean;
  masuk: (email: string, password: string) => Promise<void>;
  daftar: (data: DataDaftar) => Promise<void>;
  masukDemo: () => Promise<void>;
  keluar: () => void;
}

const Ctx = createContext<AuthValue | undefined>(undefined);

const simpanToken = (t: string) => {
  try {
    localStorage.setItem('token', t);
  } catch {
    /* tetap lanjut: sesi berlaku selama tab terbuka */
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem('token');
    } catch {
      /* abaikan */
    }
    if (!token) {
      setMemuat(false);
      return;
    }
    api
      .get('/auth/saya')
      .then((r) => setUser(r.data.user))
      .catch((e) => {
        // Hanya token yang ditolak server (401) yang membuat sesi dibuang. Gagal karena jaringan tidak boleh
        // mengeluarkan guru: tanpa internet mereka tetap masuk dengan data tersimpan.
        if ((e as { response?: { status?: number } }).response?.status !== 401) return;
        try {
          localStorage.removeItem('token');
        } catch {
          /* abaikan */
        }
        void offline.hapusDataOffline();
      })
      .finally(() => setMemuat(false));
  }, []);

  const terima = useCallback((data: { token: string; user: User }) => {
    simpanToken(data.token);
    setUser(data.user);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      memuat,
      masuk: async (email, password) => terima((await api.post('/auth/masuk', { email, password })).data),
      daftar: async (data) => terima((await api.post('/auth/daftar', data)).data),
      masukDemo: async () => terima((await api.post('/auth/demo')).data),
      keluar: () => {
        try {
          localStorage.removeItem('token');
        } catch {
          /* abaikan */
        }
        // Perangkat bisa dipakai bergantian: data offline guru ini ikut dihapus.
        void offline.hapusDataOffline();
        setUser(null);
      },
    }),
    [user, memuat, terima]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return v;
}
