import type { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import type { Penyimpanan } from './penyimpanan';

// Cache data untuk mode offline, dipasang sebagai interceptor axios:
//  - GET yang berhasil pada daftar putih disimpan, per akun.
//  - GET yang gagal karena jaringan (bukan error server) dijawab dari simpanan bila ada, jadi halaman yang sudah
//    pernah dibuka tetap tampil tanpa mengubah kode halamannya.
//  - Permintaan tulis (POST/PUT/PATCH/DELETE) TIDAK pernah dijawab dari cache; ia gagal apa adanya.
// Ini sengaja tidak memakai cache service worker: data tiap guru harus bisa dihapus saat keluar akun dan tidak boleh
// bercampur antar akun di satu perangkat.

// Hanya data baca milik guru. Ekspor (blob), pembuatan AI, dan apa pun yang memuat token Google tidak ada di sini.
const DAFTAR_PUTIH = [
  /^\/auth\/saya$/,
  /^\/modul(\/[^/]+)?$/,
  /^\/soal(\/[^/]+)?$/,
  /^\/kelas(\/[^/]+)?$/,
  /^\/kelas\/[^/]+\/rekap$/,
  /^\/kelas\/siswa\/[^/]+\/rapor$/,
  /^\/dampak$/,
];

export const bolehDiCache = (url?: string): boolean => !!url && DAFTAR_PUTIH.some((p) => p.test(url));

const urutkan = (params: unknown): string => {
  if (!params || typeof params !== 'object') return '';
  return JSON.stringify(Object.entries(params as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
};

/** Kunci simpanan: id akun | url | parameter. Awalan id akun memungkinkan pembersihan dan pemisahan per akun. */
export const kunciCache = (idPengguna: string, url: string, params?: unknown): string => `${idPengguna}|${url}|${urutkan(params)}`;

/** Id akun dari klaim `sub` token JWT. Hanya untuk memisahkan cache; keabsahan token tetap diperiksa server. */
export function idDariToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const bagian = token.split('.')[1];
    const json = atob(bagian.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

export interface EntriCache {
  url: string;
  params?: unknown;
  data: unknown;
  /** Waktu (ms) data ini disimpan. */
  tersimpan: number;
}

export type ResponsDariCache = AxiosResponse & { dariCache: true; tersimpan: number };

export interface OpsiCache {
  idPengguna: () => string | null;
  onOnline: () => void;
  onOffline: () => void;
  /** Dipanggil setelah permintaan tulis berhasil, supaya data yang terdampak bisa disegarkan. */
  onUbah: (url: string) => void;
}

export function pasangCacheOffline(api: AxiosInstance, simpanan: Penyimpanan, opsi: OpsiCache): void {
  const metode = (r?: { method?: string }) => (r?.method ?? 'get').toLowerCase();

  api.interceptors.response.use(
    (res) => {
      opsi.onOnline();
      const url = res.config.url ?? '';
      if (metode(res.config) === 'get') {
        const id = opsi.idPengguna();
        if (id && bolehDiCache(url) && !(res as Partial<ResponsDariCache>).dariCache) {
          const entri: EntriCache = { url, params: res.config.params, data: res.data, tersimpan: Date.now() };
          void simpanan.simpan(kunciCache(id, url, res.config.params), entri);
        }
      } else {
        opsi.onUbah(url);
      }
      return res;
    },
    async (err: AxiosError) => {
      // Tanpa `response` berarti permintaan tidak sampai ke server (offline, DNS, timeout); bukan galat dari server.
      const gagalJaringan = !err.response && err.code !== 'ERR_CANCELED';
      if (!gagalJaringan) throw err;

      opsi.onOffline();
      const cfg = err.config;
      const id = opsi.idPengguna();
      if (cfg && id && metode(cfg) === 'get' && bolehDiCache(cfg.url)) {
        const entri = await simpanan.ambil<EntriCache>(kunciCache(id, cfg.url!, cfg.params));
        if (entri) {
          const res: ResponsDariCache = {
            data: entri.data,
            status: 200,
            statusText: 'OK (tersimpan)',
            headers: {},
            config: cfg,
            request: null,
            dariCache: true,
            tersimpan: entri.tersimpan,
          };
          return res;
        }
      }
      throw err;
    }
  );
}
