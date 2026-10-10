import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { offline } from '../lib/api';
import { useJaringan } from '../lib/offline/jaringan';
import { BannerStatus, PanelOffline } from './StatusOffline';
import { Ikon, Logo, Memuat } from './ui';

const MENU: { ke: string; label: string; ikon: 'beranda' | 'modul' | 'soal' | 'kelas' | 'dampak' }[] = [
  { ke: '/dashboard', label: 'Beranda', ikon: 'beranda' },
  { ke: '/modul', label: 'Modul Ajar', ikon: 'modul' },
  { ke: '/soal', label: 'Bank Soal', ikon: 'soal' },
  { ke: '/kelas', label: 'Kelas & Nilai', ikon: 'kelas' },
  { ke: '/dampak', label: 'Dampak & Peta Belajar', ikon: 'dampak' },
];

// Halaman yang daftarnya ikut tersaring oleh kolom cari di bilah atas.
const HALAMAN_CARI = ['/modul', '/soal', '/kelas'];

export function Gerbang({ children }: { children: ReactNode }) {
  const { user, memuat } = useAuth();
  if (memuat) return <Memuat />;
  if (!user) return <Navigate to="/masuk" replace />;
  return <>{children}</>;
}

function KolomCari() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const langsung = HALAMAN_CARI.includes(pathname);
  const [teks, setTeks] = useState(sp.get('q') ?? '');

  // Pindah halaman: kolom ikut isi ?q= halaman itu (kosong bila halamannya tidak mendukung pencarian).
  useEffect(() => setTeks(langsung ? sp.get('q') ?? '' : ''), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function ubah(v: string) {
    setTeks(v);
    if (langsung) setSp(v ? { q: v } : {}, { replace: true });
  }

  function kirim(e: FormEvent) {
    e.preventDefault();
    if (!langsung && teks.trim()) navigate(`/modul?q=${encodeURIComponent(teks.trim())}`);
  }

  return (
    <form onSubmit={kirim} role="search" className="relative min-w-0 flex-1 sm:max-w-md">
      <Ikon nama="cari" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-300" />
      <input
        type="search"
        aria-label="Cari modul, soal, atau kelas"
        placeholder="Search..."
        value={teks}
        onChange={(e) => ubah(e.target.value)}
        className="w-full rounded-[21px] border-[0.5px] border-[#999] bg-white py-2.5 pl-11 pr-4 text-sm placeholder:text-tinta-300 focus:border-ajarin-500 focus:outline-none focus:ring-2 focus:ring-ajarin-500/20"
      />
    </form>
  );
}

export default function Layout() {
  const { user, keluar } = useAuth();
  const [terbuka, setTerbuka] = useState(false);
  const { pathname } = useLocation();
  const { online } = useJaringan();

  useEffect(() => setTerbuka(false), [pathname]);

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
          <PanelOffline />
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
            <div
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ajarin-100 text-sm font-bold text-ajarin-700"
              title={user?.nama}
              role="img"
              aria-label={`Akun ${user?.nama ?? ''}`}
            >
              {inisial}
            </div>
          </div>
          <main>
            <BannerStatus />
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
