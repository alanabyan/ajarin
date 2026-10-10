import { useRegisterSW } from 'virtual:pwa-register/react';
import { pasangAplikasi, useJaringan } from '../lib/offline/jaringan';

const waktu = (ms: number) =>
  new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Banner di atas konten: menjelaskan apa yang tampil saat offline dan menawarkan pembaruan versi.
export function BannerStatus() {
  const { online, terakhirSiap } = useJaringan();
  const {
    needRefresh: [versiBaru],
    updateServiceWorker,
  } = useRegisterSW();

  if (online && !versiBaru) return null;

  return (
    <div className="tanpa-cetak mb-4 space-y-3">
      {!online && (
        <div role="status" className="rounded-lg border border-pelita-400/50 bg-pelita-50 px-4 py-3 text-sm text-pelita-700">
          <p className="font-semibold">Anda sedang offline</p>
          <p className="mt-0.5">
            Yang tampil adalah data tersimpan{terakhirSiap ? ` (diperbarui ${waktu(terakhirSiap)})` : ''}. Modul, soal, dan rekap nilai tetap bisa
            dibaca dan dicetak. Membuat dengan AI, menyimpan perubahan, impor nilai, dan unduhan baru bisa dipakai lagi setelah tersambung internet.
          </p>
        </div>
      )}
      {versiBaru && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tinta-100 bg-white px-4 py-3 text-sm">
          <span>Versi baru Ajarin tersedia.</span>
          <button type="button" onClick={() => void updateServiceWorker(true)} className="btn-utama py-1">
            Muat ulang
          </button>
        </div>
      )}
    </div>
  );
}

// Di sidebar: kesiapan data offline dan tombol pasang aplikasi.
export function PanelOffline() {
  const { online, menyiapkan, progres, terakhirSiap, bisaPasang } = useJaringan();

  let teks: string | null = null;
  if (!online) teks = 'Offline: memakai data tersimpan';
  else if (menyiapkan) teks = `Menyimpan untuk offline… ${progres.selesai}/${progres.total || '…'}`;
  else if (terakhirSiap) teks = `Siap offline · ${waktu(terakhirSiap)}`;

  return (
    <div className="px-5 pb-3 text-xs text-white/90">
      <p aria-live="polite" className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${!online ? 'bg-pelita-400' : menyiapkan ? 'animate-pulse bg-white/60' : 'bg-emerald-400'}`} />
        <span>{teks ?? 'Online'}</span>
      </p>
      {bisaPasang && (
        <button type="button" onClick={() => void pasangAplikasi()} className="mt-2 text-sm text-white underline hover:no-underline">
          Pasang aplikasi di perangkat
        </button>
      )}
    </div>
  );
}
