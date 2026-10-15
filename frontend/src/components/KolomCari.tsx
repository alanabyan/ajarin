import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { cocok, teksKelas, teksModul, teksSoal } from '../lib/cari';
import type { KelasRingkas, ModulRingkas, SetSoalRingkas } from '../types';
import { Ikon } from './ui';

// Halaman daftar yang ikut tersaring langsung (lewat ?q=) saat guru mengetik.
const HALAMAN_CARI = ['/modul', '/soal', '/kelas'];

const PER_GRUP = 5;
const SEGAR_SETELAH = 30_000;

interface Hasil {
  id: string;
  judul: string;
  ket: string;
  ke: string;
}

interface Grup {
  jenis: 'modul' | 'soal' | 'kelas';
  label: string;
  daftar: string; // halaman daftarnya
  hasil: Hasil[];
  total: number;
}

interface Data {
  modul: ModulRingkas[];
  soal: SetSoalRingkas[];
  kelas: KelasRingkas[];
  waktu: number;
}

function kelompokkan(data: Data, kueri: string): Grup[] {
  const ambil = <T,>(daftar: T[], teks: (x: T) => string) => daftar.filter((x) => cocok(teks(x), kueri));
  const modul = ambil(data.modul, teksModul);
  const soal = ambil(data.soal, teksSoal);
  const kelas = ambil(data.kelas, teksKelas);
  const grup: Grup[] = [
    {
      jenis: 'modul',
      label: 'Modul Ajar',
      daftar: '/modul',
      total: modul.length,
      hasil: modul.slice(0, PER_GRUP).map((m) => ({
        id: m.id,
        judul: m.judul,
        ket: [m.mapel, `${m.jenjang} kelas ${m.kelas}`, m.semester && `Semester ${m.semester}`].filter(Boolean).join(' · '),
        ke: `/modul/${m.id}`,
      })),
    },
    {
      jenis: 'soal',
      label: 'Bank Soal',
      daftar: '/soal',
      total: soal.length,
      hasil: soal.slice(0, PER_GRUP).map((s) => ({
        id: s.id,
        judul: s.judul,
        ket: `${s.mapel} · kelas ${s.kelas} · ${s.jumlahSoal} soal`,
        ke: `/soal/${s.id}`,
      })),
    },
    {
      jenis: 'kelas',
      label: 'Kelas',
      daftar: '/kelas',
      total: kelas.length,
      hasil: kelas.slice(0, PER_GRUP).map((k) => ({
        id: k.id,
        judul: `Kelas ${k.nama}`,
        ket: `${k.tapel} · ${k.jumlahSiswa} siswa`,
        ke: `/kelas/${k.id}`,
      })),
    },
  ];
  return grup.filter((g) => g.total > 0);
}

/**
 * Kolom cari di bilah atas. Mencari modul, set soal, dan kelas sekaligus dan menampilkan hasilnya di bawah kolom.
 * Di halaman daftar (Modul, Bank Soal, Kelas), daftarnya juga ikut tersaring langsung lewat ?q=.
 */
export default function KolomCari() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const langsung = HALAMAN_CARI.includes(pathname);
  const [teks, setTeks] = useState(sp.get('q') ?? '');
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(-1);
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [gagal, setGagal] = useState(false);
  const wadah = useRef<HTMLFormElement>(null);

  // Pindah halaman: kolom ikut isi ?q= halaman itu (kosong bila halamannya tidak mendukung penyaringan).
  useEffect(() => {
    setTeks(langsung ? sp.get('q') ?? '' : '');
    setBuka(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Data dimuat saat kolom dipakai, lalu disegarkan paling sering tiap 30 detik (data baru setelah membuat modul/soal/kelas).
  function muat() {
    if (memuat || (data && Date.now() - data.waktu < SEGAR_SETELAH)) return;
    setMemuat(true);
    Promise.all([api.get('/modul'), api.get('/soal'), api.get('/kelas')])
      .then(([m, s, k]) => {
        setData({ modul: m.data.modul, soal: s.data.set, kelas: k.data.kelas, waktu: Date.now() });
        setGagal(false);
      })
      .catch(() => setGagal(true))
      .finally(() => setMemuat(false));
  }

  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (!wadah.current?.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener('pointerdown', luar);
    return () => document.removeEventListener('pointerdown', luar);
  }, [buka]);

  const kueri = teks.trim();
  const grup = data && kueri ? kelompokkan(data, kueri) : [];
  const datar = grup.flatMap((g) => g.hasil);
  const tampilPanel = buka && kueri.length > 0;

  function ubah(v: string) {
    setTeks(v);
    setAktif(-1);
    setBuka(true);
    muat();
    if (langsung) setSp(v ? { q: v } : {}, { replace: true });
  }

  function pergi(ke: string) {
    setBuka(false);
    navigate(ke);
  }

  function kirim(e: FormEvent) {
    e.preventDefault();
    if (aktif >= 0 && datar[aktif]) return pergi(datar[aktif].ke);
    // Di halaman daftar, Enter cukup menutup panel: daftarnya sudah tersaring.
    if (langsung) return setBuka(false);
    // Di halaman lain: buka hasil teratas, atau halaman daftar grup pertama bila hasilnya banyak.
    if (datar.length === 1) return pergi(datar[0].ke);
    if (grup[0]) pergi(`${grup[0].daftar}?q=${encodeURIComponent(kueri)}`);
  }

  function tombol(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setBuka(false);
      return;
    }
    if (!tampilPanel || datar.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAktif((n) => (n + 1) % datar.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAktif((n) => (n <= 0 ? datar.length - 1 : n - 1));
    }
  }

  let urut = -1;

  return (
    <form ref={wadah} onSubmit={kirim} role="search" data-tour="cari" className="relative min-w-0 flex-1 sm:max-w-md">
      <Ikon nama="cari" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-300" />
      <input
        type="search"
        role="combobox"
        aria-label="Cari modul, soal, atau kelas"
        aria-expanded={tampilPanel}
        aria-controls="hasil-cari"
        aria-autocomplete="list"
        aria-activedescendant={aktif >= 0 ? `hasil-cari-${aktif}` : undefined}
        placeholder="Cari modul, soal, atau kelas..."
        value={teks}
        onChange={(e) => ubah(e.target.value)}
        onFocus={() => {
          muat();
          if (kueri) setBuka(true);
        }}
        onKeyDown={tombol}
        className="w-full rounded-[21px] border-[0.5px] border-[#999] bg-white py-2.5 pl-11 pr-4 text-sm placeholder:text-tinta-300 focus:border-ajarin-500 focus:outline-none focus:ring-2 focus:ring-ajarin-500/20"
      />

      {tampilPanel && (
        <div
          id="hasil-cari"
          role="listbox"
          aria-label="Hasil pencarian"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-[14px] border border-tinta-100 bg-white py-2 shadow-kartu sm:min-w-[24rem]"
        >
          {!data ? (
            <p className="px-4 py-3 text-sm text-tinta-500">{gagal ? 'Gagal memuat data. Periksa koneksi lalu coba lagi.' : 'Mencari...'}</p>
          ) : grup.length === 0 ? (
            <p className="px-4 py-3 text-sm text-tinta-500">
              Tidak ada modul, soal, atau kelas yang cocok dengan “{kueri}”.
            </p>
          ) : (
            grup.map((g) => (
              <div key={g.jenis} role="group" aria-label={g.label} className="py-1">
                <p className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-tinta-500">
                  {g.label} <span className="font-semibold normal-case">({g.total})</span>
                </p>
                {g.hasil.map((h) => {
                  urut += 1;
                  const n = urut;
                  return (
                    <div
                      key={h.id}
                      id={`hasil-cari-${n}`}
                      role="option"
                      aria-selected={aktif === n}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => pergi(h.ke)}
                      onMouseEnter={() => setAktif(n)}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${aktif === n ? 'bg-ajarin-50' : ''}`}
                    >
                      <Ikon nama={g.jenis} className="h-4 w-4 shrink-0 text-ajarin-500" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-tinta-900">{h.judul}</span>
                        <span className="block truncate text-xs text-tinta-500">{h.ket}</span>
                      </span>
                    </div>
                  );
                })}
                {g.total > g.hasil.length && (
                  <button
                    type="button"
                    onClick={() => pergi(`${g.daftar}?q=${encodeURIComponent(kueri)}`)}
                    className="px-4 py-1.5 text-xs font-bold text-ajarin-500 hover:underline"
                  >
                    Lihat semua {g.total} hasil di {g.label}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </form>
  );
}
