import { useSyncExternalStore } from 'react';

// Status jaringan dan kesiapan mode offline, dibagikan ke seluruh aplikasi.
// `navigator.onLine` tidak bisa dipercaya sendirian (bernilai true di Wi-Fi tanpa internet), jadi status juga
// diperbarui dari hasil permintaan sebenarnya: gagal karena jaringan -> offline, berhasil -> online.

export interface StatusJaringan {
  online: boolean;
  menyiapkan: boolean;
  progres: { selesai: number; total: number };
  /** Waktu (ms) data offline terakhir selesai disiapkan; null bila belum pernah. */
  terakhirSiap: number | null;
  bisaPasang: boolean;
  versiBaru: boolean;
}

let status: StatusJaringan = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  menyiapkan: false,
  progres: { selesai: 0, total: 0 },
  terakhirSiap: null,
  bisaPasang: false,
  versiBaru: false,
};

const pendengar = new Set<() => void>();

export const ambilStatus = () => status;

export function ubahStatus(sebagian: Partial<StatusJaringan>) {
  const berubah = (Object.keys(sebagian) as (keyof StatusJaringan)[]).some((k) => JSON.stringify(status[k]) !== JSON.stringify(sebagian[k]));
  if (!berubah) return;
  status = { ...status, ...sebagian };
  pendengar.forEach((p) => p());
}

export const tandaiOnline = () => ubahStatus({ online: true });
export const tandaiOffline = () => ubahStatus({ online: false });

export function useJaringan(): StatusJaringan {
  return useSyncExternalStore(
    (cb) => {
      pendengar.add(cb);
      return () => pendengar.delete(cb);
    },
    ambilStatus,
    ambilStatus
  );
}

// Prompt pemasangan PWA ditahan supaya bisa dipicu dari tombol sendiri.
interface PromptPasang extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let promptPasang: PromptPasang | null = null;

export async function pasangAplikasi(): Promise<void> {
  if (!promptPasang) return;
  const p = promptPasang;
  promptPasang = null;
  ubahStatus({ bisaPasang: false });
  await p.prompt();
  await p.userChoice;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => ubahStatus({ online: true }));
  window.addEventListener('offline', () => ubahStatus({ online: false }));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptPasang = e as PromptPasang;
    ubahStatus({ bisaPasang: true });
  });
  window.addEventListener('appinstalled', () => {
    promptPasang = null;
    ubahStatus({ bisaPasang: false });
  });
}
