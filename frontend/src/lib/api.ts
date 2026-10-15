import axios from 'axios';
import { idDariToken, pasangCacheOffline } from './offline/cacheApi';
import { tandaiOffline, tandaiOnline } from './offline/jaringan';
import { bukaIdb } from './offline/penyimpanan';
import { buatPenyiap } from './offline/siapkan';

// Semua rute backend ada di bawah /api; awalan itu ditambahkan bila lupa disertakan di VITE_API_URL.
const dasar = ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/+$/, '');
const api = axios.create({ baseURL: dasar.endsWith('/api') ? dasar : `${dasar}/api` });

const bacaToken = (): string | null => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null; // penyimpanan tidak tersedia
  }
};

api.interceptors.request.use((config) => {
  const token = bacaToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Mode offline: data baca disimpan per akun dan disajikan saat jaringan gagal (lihat lib/offline).
const simpananOffline = bukaIdb();
const idPengguna = () => idDariToken(bacaToken());
export const offline = buatPenyiap(api, simpananOffline, idPengguna);
pasangCacheOffline(api, simpananOffline, {
  idPengguna,
  onOnline: tandaiOnline,
  onOffline: tandaiOffline,
  onUbah: offline.segarkanSetelahUbah,
});

export const PESAN_OFFLINE = 'Tidak ada koneksi internet. Fitur ini butuh internet; coba lagi saat sudah tersambung.';

interface DataGalat {
  error?: string;
  /** Pesan per kolom formulir, mis. { judul: '...' }. */
  kolom?: Record<string, string>;
  /** Kode galat khusus, mis. BELUM_VERIFIKASI, PERINGATAN_AI. */
  kode?: string;
  email?: string;
}

/** Galat dari permintaan fetch (postAlir), membawa data respons seperti galat axios. */
export class GalatApi extends Error {
  constructor(
    message: string,
    public data: DataGalat = {}
  ) {
    super(message);
  }
}

function dataGalat(err: unknown): DataGalat {
  if (err instanceof GalatApi) return err.data;
  return (err as { response?: { data?: DataGalat } })?.response?.data ?? {};
}

// Pesan galat yang ramah dari respons API.
export function pesanError(err: unknown, cadangan = 'Terjadi kesalahan. Coba lagi.'): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string; code?: string };
  if (!e?.response && (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error')) return PESAN_OFFLINE;
  return e?.response?.data?.error || e?.message || cadangan;
}

/** Pesan per kolom dari galat validasi server ({} bila tidak ada). */
export const kolomError = (err: unknown): Record<string, string> => dataGalat(err).kolom ?? {};

/** Kode galat khusus dari server, mis. 'BELUM_VERIFIKASI'. */
export const kodeError = (err: unknown): string | undefined => dataGalat(err).kode;

// POST yang dibalas aliran baris JSON (NDJSON), mis. teks modul yang ditulis AI bertahap.
// Axios di browser tidak bisa membaca respons sebagian, jadi memakai fetch. Galat HTTP dilempar sebagai Error
// berpesan ramah, sama seperti di tempat lain.
export async function postAlir<T>(url: string, body: unknown, onBaris: (b: T) => void, signal?: AbortSignal): Promise<void> {
  const token = bacaToken();
  let res: Response;
  try {
    res = await fetch(`${api.defaults.baseURL}${url}`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // fetch hanya melempar TypeError bila permintaan tidak sampai ke server; pembatalan (AbortError) dibiarkan lewat.
    if (e instanceof TypeError) {
      tandaiOffline();
      throw new Error(PESAN_OFFLINE);
    }
    throw e;
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as DataGalat | null;
    throw new GalatApi(data?.error || 'Terjadi kesalahan. Coba lagi.', data ?? {});
  }

  const reader = res.body.getReader();
  const dekoder = new TextDecoder();
  let sisa = '';
  const proses = (baris: string) => {
    if (baris.trim()) onBaris(JSON.parse(baris) as T);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sisa += dekoder.decode(value, { stream: true });
    const baris = sisa.split('\n');
    sisa = baris.pop() ?? '';
    baris.forEach(proses);
  }
  proses(sisa);
}

// Mengunduh respons biner (Excel) sebagai file.
export async function unduh(url: string, params: Record<string, string | number> | undefined, namaCadangan: string) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposisi: string = res.headers['content-disposition'] ?? '';
  const nama = /filename="([^"]+)"/.exec(disposisi)?.[1] ?? namaCadangan;
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return res.headers;
}

export default api;
