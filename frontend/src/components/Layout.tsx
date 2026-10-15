import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { offline } from '../lib/api';
import { useJaringan } from '../lib/offline/jaringan';
import PanduanTur, { tandaiTurDilihat, turSudahDilihat } from './PanduanTur';
import KolomCari from './KolomCari';
import { BannerStatus, PanelOffline } from './StatusOffline';
import { Ikon, Logo, Memuat } from './ui';

const MENU: { ke: string; label: string; ikon: 'beranda' | 'modul' | 'soal' | 'kelas' | 'dampak' }[] = [
  { ke: '/dashboard', label: 'Beranda', ikon: 'beranda' },
  { ke: '/modul', label: 'Modul Ajar', ikon: 'modul' },
  { ke: '/soal', label: 'Bank Soal', ikon: 'soal' },
  { ke: '/kelas', label: 'Kelas & Nilai', ikon: 'kelas' },
  { ke: '/dampak', label: 'Dampak & Peta Belajar', ikon: 'dampak' },
];

export function Gerbang({ children }: { children: ReactNode }) {
  const { user, memuat } = useAuth();
  if (memuat) return <Memuat />;
  if (!user) return <Navigate to="/masuk" replace />;
  return <>{children}</>;
}

/** Menu akun di pojok kanan atas: selalu terlihat (juga di HP), berisi identitas akun dan tombol Keluar. */
function MenuAkun({ inisial, onPanduan, onKeluar }: { inisial: string; onPanduan: () => void; onKeluar: () => void }) {
  const { user } = useAuth();
  const [buka, setBuka] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);
  const tombol = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setBuka(false), [pathname]);

  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (!wadah.current?.contains(e.target as Node)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBuka(false);
        tombol.current?.focus();
      }
    };
    document.addEventListener('pointerdown', luar);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', luar);
      document.removeEventListener('keydown', esc);
    };
  }, [buka]);

  return (
    <div ref={wadah} className="relative shrink-0" data-tour="akun">
      <button
        ref={tombol}
        type="button"
        aria-haspopup="menu"
        aria-expanded={buka}
        aria-controls="menu-akun"
        onClick={() => setBuka((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-tinta-100 py-1 pl-1 pr-2 transition-colors hover:bg-ajarin-50 sm:pr-3"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ajarin-100 text-sm font-bold text-ajarin-700" aria-hidden="true">
          {inisial}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm font-semibold text-tinta-900 md:block">{user?.nama}</span>
        <span className="sr-only">Menu akun {user?.nama}</span>
        <Ikon nama="bawah" className={`h-4 w-4 text-tinta-500 transition-transform ${buka ? 'rotate-180' : ''}`} />
      </button>
      {buka && (
        <div id="menu-akun" role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-[14px] border border-tinta-100 bg-white shadow-kartu">
          <div className="border-b border-tinta-100 px-4 py-3">
            <p className="truncate font-bold text-tinta-900">{user?.nama}</p>
            <p className="truncate text-xs text-tinta-500">{user?.email}</p>
            {user?.sekolah ? (
              <p className="mt-1 truncate text-xs text-tinta-500">{user.sekolah}</p>
            ) : (
              <p className="mt-1 text-xs italic text-tinta-300">Nama sekolah belum diisi</p>
            )}
          </div>
          <Link
            to="/profil"
            role="menuitem"
            onClick={() => setBuka(false)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-tinta-900 hover:bg-ajarin-50"
          >
            <Ikon nama="profil" className="h-5 w-5 text-ajarin-500" /> Profil saya
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setBuka(false);
              onPanduan();
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-tinta-900 hover:bg-ajarin-50"
          >
            <Ikon nama="bantuan" className="h-5 w-5 text-ajarin-500" /> Panduan fitur
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onKeluar}
            className="flex w-full items-center gap-3 border-t border-tinta-100 px-4 py-3 text-left text-sm font-bold text-merah hover:bg-red-50"
          >
            <Ikon nama="keluar" className="h-5 w-5" /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, keluar } = useAuth();
  const [terbuka, setTerbuka] = useState(false);
  const { pathname } = useLocation();
  const { online } = useJaringan();
  const [tur, setTur] = useState(false);

  useEffect(() => setTerbuka(false), [pathname]);

  // Tur fitur muncul otomatis sekali per akun, saat pertama kali membuka beranda dashboard.
  useEffect(() => {
    if (!user || pathname !== '/dashboard' || turSudahDilihat(user.id)) return;
    const t = window.setTimeout(() => setTur(true), 800);
    return () => window.clearTimeout(t);
  }, [user?.id, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function tutupTur() {
    if (user) tandaiTurDilihat(user.id);
    setTur(false);
  }

  // Menyiapkan data offline di latar belakang setiap kali guru masuk atau koneksi kembali (dibatasi tiap 15 menit).
  useEffect(() => {
    if (user) offline.muatStatus(); // juga saat offline, supaya "diperbarui kapan" tetap tampil
  }, [user?.id]);

  useEffect(() => {
    if (user && online) void offline.siapkanOffline();
  }, [user?.id, online]);

  function keluarAkun() {
    if (!online && !window.confirm('Anda sedang offline. Jika keluar sekarang, data offline di perangkat ini dihapus dan Anda baru bisa masuk lagi setelah ada internet. Tetap keluar?')) return;
    keluar();
  }

  const inisial = (user?.nama ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-screen lg:flex lg:gap-2 lg:p-4">
      {terbuka && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setTerbuka(false)}
          className="tanpa-cetak fixed inset-0 z-30 bg-tinta-900/50 lg:hidden"
        />
      )}

      <aside
        id="menu-samping"
        className={`tanpa-cetak fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-ajarin-500 p-4 text-white transition-transform lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-72 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:rounded-[14px] ${
          terbuka ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-center px-2 pb-6 pt-4">
          <Logo ke="/dashboard" terang />
        </div>
        <nav className="space-y-1.5" aria-label="Menu utama">
          {MENU.map((m) => (
            <NavLink
              key={m.ke}
              to={m.ke}
              data-tour={`menu-${m.ikon}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[21px] px-5 py-2.5 text-base transition-colors ${
                  isActive ? 'bg-white font-semibold text-ajarin-500' : 'font-semibold text-white hover:bg-white/15'
                }`
              }
            >
              <Ikon nama={m.ikon} />
              {m.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <div data-tour="offline">
            <PanelOffline />
          </div>
          <div className="overflow-hidden rounded-[14px] bg-white pt-5 text-ajarin-500">
            <div className="px-4 pb-3">
              <p className="text-xl font-bold leading-tight">Sudah selesai?</p>
              <p className="mt-2 text-[10px] font-semibold leading-snug">Jangan lupa logout dari website untuk menjaga keamanan data akun anda</p>
              <button type="button" onClick={keluarAkun} className="btn-utama mt-3 px-5 py-1.5 text-xs">
                Keluar
              </button>
            </div>
            {/* Ilustrasi hanya untuk desktop; di tablet/HP dan layar yang pendek disembunyikan agar menu tetap lega. */}
            <img
              src="/ilustrasi-logout.png"
              alt=""
              width={540}
              height={458}
              className="mx-auto hidden max-h-[26vh] w-auto max-w-full object-contain lg:block [@media(max-height:700px)]:hidden"
              loading="lazy"
            />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 sm:px-6 lg:pt-2">
          <div className="tanpa-cetak mb-5 flex items-center gap-3">
            <button
              type="button"
              aria-expanded={terbuka}
              aria-controls="menu-samping"
              aria-label="Buka menu"
              onClick={() => setTerbuka((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-tinta-100 text-ajarin-600 lg:hidden"
            >
              <Ikon nama="menu" />
            </button>
            <KolomCari />
            <button
              type="button"
              data-tour="panduan"
              onClick={() => setTur(true)}
              aria-label="Buka panduan fitur"
              title="Panduan fitur"
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-tinta-100 text-lg font-bold text-ajarin-600 transition-colors hover:bg-ajarin-50"
            >
              ?
            </button>
            <MenuAkun inisial={inisial} onPanduan={() => setTur(true)} onKeluar={keluarAkun} />
          </div>
          <main>
            <BannerStatus />
            <Outlet />
          </main>
        </div>
      </div>
      <PanduanTur buka={tur} onTutup={tutupTur} onBukaMenu={setTerbuka} />
    </div>
  );
}
