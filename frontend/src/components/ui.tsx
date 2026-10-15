import { ReactNode, SelectHTMLAttributes, useState } from 'react';
import { MAPEL_PER_JENJANG } from '../lib/akademik';
import type { Jenjang } from '../types';
import { Link, useSearchParams } from 'react-router-dom';

export const NAMA_APP = 'AJARIN';
export const SLOGAN = 'Bantu Guru Fokus Mengajar';

export function Logo({ ke = '/', terang = false }: { ke?: string; terang?: boolean }) {
  const warna = terang ? 'text-white' : 'text-ajarin-500';
  return (
    <Link to={ke} className={`inline-flex flex-col items-center ${warna}`} aria-label={NAMA_APP}>
      <span className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" className="h-[35px] w-[35px]" fill="currentColor" aria-hidden="true">
          <path d="M5 3.5A2.5 2.5 0 0 0 2.5 6v10A2.5 2.5 0 0 0 5 18.5h6.25V20.5H8.5a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-2.75v-2H19a2.5 2.5 0 0 0 2.5-2.5V6A2.5 2.5 0 0 0 19 3.5zm3.2 9.8 4.5-6.2a.75.75 0 0 1 1.2.02l2.9 4.2 1.1-1.3a.75.75 0 0 1 1.14.97l-1.7 2a.75.75 0 0 1-1.2-.06l-2.8-4-3.9 5.35a.75.75 0 0 1-1.24-.9z" />
        </svg>
        <span className="text-2xl font-bold uppercase leading-none">{NAMA_APP}</span>
      </span>
      <span className={`mt-0.5 text-[8px] font-medium capitalize tracking-[0.8px] ${terang ? 'text-white' : 'text-tinta-500'}`}>{SLOGAN}</span>
    </Link>
  );
}

/**
 * Judul halaman + tombol aksi. `bertumpuk`: tombol di baris sendiri di bawah judul, untuk halaman dengan banyak
 * aksi; tanpa itu tombol di samping judul dan judul yang panjang ikut terjepit.
 */
export function Header({ judul, deskripsi, aksi, bertumpuk = false }: { judul: string; deskripsi?: string; aksi?: ReactNode; bertumpuk?: boolean }) {
  if (bertumpuk) {
    return (
      <div className="mb-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight">{judul}</h1>
          {deskripsi && <p className="mt-1.5 text-sm font-medium text-tinta-500">{deskripsi}</p>}
        </div>
        {aksi && <div className="tanpa-cetak flex flex-wrap gap-2">{aksi}</div>}
      </div>
    );
  }
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold">{judul}</h1>
        {deskripsi && <p className="mt-1 text-sm text-tinta-300">{deskripsi}</p>}
      </div>
      {aksi && <div className="tanpa-cetak flex shrink-0 flex-wrap gap-2">{aksi}</div>}
    </div>
  );
}

/** Tombol kembali ke halaman induk (bukan riwayat browser), supaya tetap jelas walau halaman dibuka langsung. */
export function TombolKembali({ ke, label }: { ke: string; label: string }) {
  return (
    <Link
      to={ke}
      className="tanpa-cetak mb-3 inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-bold text-ajarin-500 transition-colors hover:bg-ajarin-50 hover:text-ajarin-600"
    >
      <Ikon nama="kiri" className="h-5 w-5" />
      {label}
    </Link>
  );
}

export function Kosong({ judul, isi, aksi }: { judul: string; isi: string; aksi?: ReactNode }) {
  return (
    <div className="kartu py-10 text-center">
      <p className="text-lg font-bold">{judul}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-tinta-500">{isi}</p>
      {aksi && <div className="mt-4">{aksi}</div>}
    </div>
  );
}

type Nada = 'galat' | 'info' | 'sukses' | 'awas';
const WARNA: Record<Nada, string> = {
  galat: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-tinta-100 bg-tinta-50 text-tinta-900',
  sukses: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  awas: 'border-pelita-400/50 bg-pelita-50 text-pelita-700',
};

export function Pesan({ nada = 'info', children }: { nada?: Nada; children: ReactNode }) {
  return (
    <div role={nada === 'galat' ? 'alert' : 'status'} className={`peringatan ${WARNA[nada]}`}>
      {children}
    </div>
  );
}

export function Memuat({ teks = 'Memuat...' }: { teks?: string }) {
  return <p className="py-8 text-center text-tinta-500">{teks}</p>;
}

export function tanggal(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const angka = (n: number | null | undefined, desimal = 1): string =>
  n === null || n === undefined ? '–' : n.toLocaleString('id-ID', { maximumFractionDigits: desimal });

// Pilihan berbentuk pil dengan panah, untuk bilah alat tabel dan form.
export function SelectPil({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative block ${className}`}>
      <select {...rest} className="input-pil cursor-pointer appearance-none pr-10">
        {children}
      </select>
      <Ikon nama="bawah" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-300" />
    </span>
  );
}

// Tahun pelajaran (Juli-Juni) dari sebuah tanggal, mis. "2026/2027".
export function tapelDari(iso: string): string {
  const d = new Date(iso);
  const mulai = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${mulai}/${mulai + 1}`;
}

// Kata kunci pencarian dari kolom cari di bilah atas (?q=...), dipakai halaman daftar untuk menyaring.
export function useCari(): string {
  const [sp] = useSearchParams();
  return (sp.get('q') ?? '').trim().toLowerCase();
}

type NamaIkon = 'beranda' | 'modul' | 'soal' | 'kelas' | 'dampak' | 'cari' | 'hapus' | 'plus' | 'panah' | 'kanan' | 'menu' | 'bawah' | 'keluar' | 'bantuan' | 'kiri';

export function Ikon({ nama, className = 'h-5 w-5' }: { nama: NamaIkon; className?: string }) {
  const gambar: Record<NamaIkon, ReactNode> = {
    beranda: (
      <>
        <rect x="3" y="3" width="8" height="10" rx="2" />
        <rect x="13" y="3" width="8" height="6" rx="2" />
        <rect x="3" y="15" width="8" height="6" rx="2" />
        <rect x="13" y="11" width="8" height="10" rx="2" />
      </>
    ),
    modul: (
      <>
        <path d="M5 4a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2z" />
        <path d="M5 20a2 2 0 0 0 2 2h12" />
        <path d="M9 7h6" />
      </>
    ),
    soal: (
      <>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
        <path d="M4 5h8M4 9h5" />
      </>
    ),
    kelas: (
      <>
        <path d="M3 21V10l9-6 9 6v11" />
        <path d="M9 21v-6h6v6" />
        <circle cx="12" cy="10" r="1.5" />
      </>
    ),
    dampak: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    cari: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    hapus: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6" />
        <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    panah: <path d="M3 12h18m-5-5 5 5-5 5" />,
    kanan: <path d="m9 6 6 6-6 6" />,
    kiri: <path d="m15 6-6 6 6 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    bawah: <path d="m6 9 6 6 6-6" />,
    keluar: (
      <>
        <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
        <path d="M10 17l-5-5 5-5M5 12h11" />
      </>
    ),
    bantuan: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {gambar[nama]}
    </svg>
  );
}

// Sampul kartu. Modul dan kelas memakai ilustrasi roket; set soal memakai latar gradien (tanpa berkas gambar).
export function Sampul({ varian, lencana, className = '' }: { varian: 'modul' | 'kelas' | 'soal'; lencana?: string; className?: string }) {
  // Di atas ilustrasi biru muda, badge putih agar tetap terbaca; di atas gradien gelap memakai abu transparan seperti di Figma.
  const badge = lencana && (
    <span
      className={`absolute right-2.5 top-2.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase leading-none ${
        varian === 'soal' ? 'bg-[rgba(204,204,204,0.5)] text-white' : 'bg-white/90 text-ajarin-500'
      }`}
    >
      {lencana}
    </span>
  );
  if (varian !== 'soal') {
    return (
      <div className={`relative aspect-[16/10] overflow-hidden rounded-[14px] bg-[#B2D0FB] ${className}`}>
        <img src="/sampul-kartu.png" alt="" width={463} height={318} className="h-full w-full object-contain" loading="lazy" />
        {badge}
      </div>
    );
  }
  return (
    <div className={`relative aspect-[16/9] overflow-hidden rounded-[14px] bg-gradient-to-br from-ajarin-500 to-ajarin-600 ${className}`} aria-hidden="true">
      <div className="absolute -right-8 -top-4 aspect-square h-[130%] rounded-full border-[6px] border-orange-400/80 bg-ajarin-200/30" />
      <div className="absolute bottom-0 right-8 h-3/5 w-1/4 rounded-t-full bg-white/70" />
      <p className="absolute left-4 top-1/2 max-w-[55%] -translate-y-1/2 text-sm font-extrabold uppercase leading-tight text-white sm:text-base">Latih, ukur, perbaiki</p>
      {badge}
    </div>
  );
}

/**
 * Satu isian formulir: label, kontrol, petunjuk, dan pesan galat di bawahnya. Kontrol di `children` sebaiknya
 * memakai id = `id` dan `aria-invalid` / `aria-describedby` dari `propsKontrol(id, galat)`.
 */
export function Kolom({ id, label, galat, petunjuk, children }: { id: string; label: ReactNode; galat?: string; petunjuk?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {petunjuk && !galat && (
        <p id={`${id}-petunjuk`} className="mt-1.5 text-xs text-tinta-500">
          {petunjuk}
        </p>
      )}
      {galat && (
        <p id={`${id}-galat`} role="alert" className="mt-1.5 text-xs font-semibold text-merah">
          {galat}
        </p>
      )}
    </div>
  );
}

/** Atribut aksesibilitas + gaya merah untuk kontrol yang punya galat. */
export function propsKontrol(id: string, galat?: string, petunjuk?: boolean) {
  return {
    id,
    'aria-invalid': galat ? true : undefined,
    'aria-describedby': galat ? `${id}-galat` : petunjuk ? `${id}-petunjuk` : undefined,
    className: `input ${galat ? 'border-merah focus:border-merah focus:ring-merah/20' : ''}`,
  };
}

const LAINNYA = '__lainnya__';

/** Dropdown mata pelajaran sesuai jenjang, dengan "Lainnya" untuk mengetik sendiri. */
export function PilihMapel({
  id,
  jenjang,
  value,
  onChange,
  galat,
}: {
  id: string;
  jenjang: Jenjang;
  value: string;
  onChange: (v: string) => void;
  galat?: string;
}) {
  const daftar = MAPEL_PER_JENJANG[jenjang];
  const [ketik, setKetik] = useState(() => value !== '' && !daftar.includes(value));
  const lain = ketik || (value !== '' && !daftar.includes(value));
  const p = propsKontrol(id, galat);
  return (
    <div className="space-y-2">
      <select
        {...p}
        required
        value={lain ? LAINNYA : value}
        onChange={(e) => {
          if (e.target.value === LAINNYA) {
            setKetik(true);
            onChange('');
          } else {
            setKetik(false);
            onChange(e.target.value);
          }
        }}
        className={`${p.className} ${value || lain ? '' : 'text-[#999]'}`}
      >
        <option value="" disabled>
          Pilih mata pelajaran
        </option>
        {daftar.map((m) => (
          <option key={m}>{m}</option>
        ))}
        <option value={LAINNYA}>Lainnya (ketik sendiri)</option>
      </select>
      {lain && (
        <input
          aria-label="Nama mata pelajaran lainnya"
          required
          minLength={2}
          maxLength={80}
          placeholder="Tulis nama mata pelajaran"
          className={p.className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/**
 * Peringatan dari pemeriksaan isian oleh AI (kode PERINGATAN_AI). Pesan per kolom sudah tampil di bawah
 * isiannya; di sini ringkasannya, plus pilihan untuk tetap melanjutkan karena AI bisa keliru.
 */
export function PeringatanAI({
  kolom,
  label,
  onLanjut,
  sibuk,
  teksLanjut,
}: {
  kolom: Record<string, string>;
  label: Record<string, string>;
  onLanjut: () => void;
  sibuk: boolean;
  teksLanjut: string;
}) {
  return (
    <div role="alert" className="peringatan border-ajarin-200 bg-ajarin-50 text-tinta-900">
      <p className="font-bold text-ajarin-600">Pemeriksaan AI: ada isian yang tampaknya tidak sesuai</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {Object.entries(kolom).map(([k, v]) => (
          <li key={k}>
            <b>{label[k] ?? k}:</b> {v}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-tinta-500">Perbaiki isian yang ditandai lalu kirim lagi. Bila Anda yakin isian sudah benar, Anda bisa tetap melanjutkan.</p>
      <button type="button" onClick={onLanjut} disabled={sibuk} className="btn-garis mt-3 px-4 py-2 text-xs">
        {teksLanjut}
      </button>
    </div>
  );
}
