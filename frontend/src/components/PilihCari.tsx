import { KeyboardEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MAPEL_PER_JENJANG } from '../lib/akademik';
import { cocok } from '../lib/cari';
import type { Jenjang } from '../types';
import { Ikon, propsKontrol } from './ui';

export interface OpsiCari {
  nilai: string;
  label?: string;
}

export interface GrupCari {
  label?: string;
  opsi: (string | OpsiCari)[];
}

const keOpsi = (o: string | OpsiCari): Required<OpsiCari> => (typeof o === 'string' ? { nilai: o, label: o } : { nilai: o.nilai, label: o.label ?? o.nilai });

/**
 * Dropdown dengan kolom cari, untuk daftar panjang seperti mata pelajaran. Pencarian per kata, tanpa membedakan
 * huruf besar/kecil: "inggris lanjut" menemukan "Bahasa Inggris Tingkat Lanjut".
 * `aksi` = baris tambahan di bawah daftar (mis. "Lainnya, ketik sendiri") yang tidak ikut tersaring.
 */
export default function PilihCari({
  id,
  value,
  onChange,
  grup,
  placeholder = 'Pilih...',
  label,
  galat,
  varian = 'input',
  className = '',
  aksi,
  cari = true,
}: {
  id?: string;
  value: string;
  onChange: (nilai: string) => void;
  grup: GrupCari[];
  placeholder?: string;
  /** Label aksesibel bila tidak ada <label htmlFor> yang menunjuk ke `id`. */
  label?: string;
  galat?: boolean;
  varian?: 'input' | 'pil';
  className?: string;
  aksi?: { label: ReactNode; onPilih: () => void };
  /** false untuk daftar pendek: tampilan sama, tanpa kolom cari (keyboard tetap jalan di daftar). */
  cari?: boolean;
}) {
  const idOtomatis = useId();
  const idDaftar = `${id ?? idOtomatis}-daftar`;
  const [buka, setBuka] = useState(false);
  const [kueri, setKueri] = useState('');
  const [aktif, setAktif] = useState(0);
  const wadah = useRef<HTMLDivElement>(null);
  const tombol = useRef<HTMLButtonElement>(null);
  const kolomCari = useRef<HTMLInputElement>(null);
  const daftarRef = useRef<HTMLUListElement>(null);

  const semua = useMemo(() => grup.flatMap((g) => g.opsi.map(keOpsi)), [grup]);
  const terpilih = semua.find((o) => o.nilai === value);

  const tersaring = useMemo(
    () => grup.map((g) => ({ label: g.label, opsi: g.opsi.map(keOpsi).filter((o) => cocok(o.label, kueri)) })).filter((g) => g.opsi.length > 0),
    [grup, kueri]
  );
  const datar = tersaring.flatMap((g) => g.opsi);

  useEffect(() => {
    if (!buka) return;
    setKueri('');
    // Sorot pilihan saat ini supaya Enter langsung mempertahankannya.
    setAktif(Math.max(0, semua.findIndex((o) => o.nilai === value)));
    if (cari) kolomCari.current?.focus();
    else daftarRef.current?.focus();
    const luar = (e: PointerEvent) => {
      if (!wadah.current?.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener('pointerdown', luar);
    return () => document.removeEventListener('pointerdown', luar);
  }, [buka]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opsi yang disorot selalu terlihat saat digulir dengan panah.
  useEffect(() => {
    daftarRef.current?.querySelector<HTMLElement>(`[data-urut="${aktif}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [aktif]);

  function pilih(nilai: string) {
    onChange(nilai);
    setBuka(false);
    tombol.current?.focus();
  }

  function tombolKeyboard(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setBuka(false);
      tombol.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAktif((n) => Math.min(n + 1, datar.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAktif((n) => Math.max(n - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (datar[aktif]) pilih(datar[aktif].nilai);
    } else if (e.key === 'Tab') {
      setBuka(false);
    }
  }

  const gayaTombol =
    varian === 'pil'
      ? 'input-pil flex items-center text-left'
      : `input flex items-center text-left ${galat ? 'border-merah focus:border-merah focus:ring-merah/20' : ''}`;

  let urut = -1;

  return (
    <div ref={wadah} className={`relative ${className}`}>
      <button
        ref={tombol}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={buka}
        aria-controls={buka ? idDaftar : undefined}
        aria-label={label}
        aria-invalid={galat || undefined}
        onClick={() => setBuka((v) => !v)}
        onKeyDown={(e) => {
          if (!buka && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setBuka(true);
          }
        }}
        className={`${gayaTombol} w-full pr-10`}
      >
        <span className={`min-w-0 flex-1 truncate ${terpilih ? '' : 'text-[#999]'}`}>{terpilih?.label ?? (value || placeholder)}</span>
      </button>
      <Ikon
        nama="bawah"
        className={`pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-300 transition-transform ${buka ? 'rotate-180' : ''}`}
      />

      {buka && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-full min-w-[16rem] overflow-hidden rounded-[14px] border border-tinta-100 bg-white shadow-kartu">
          {cari && (
          <div className="relative border-b border-tinta-100 p-2">
            <Ikon nama="cari" className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-300" />
            <input
              ref={kolomCari}
              type="search"
              role="combobox"
              aria-label="Cari pilihan"
              aria-expanded
              aria-controls={idDaftar}
              aria-activedescendant={datar[aktif] ? `${idDaftar}-${aktif}` : undefined}
              placeholder="Ketik untuk mencari..."
              value={kueri}
              onChange={(e) => {
                setKueri(e.target.value);
                setAktif(0);
              }}
              onKeyDown={tombolKeyboard}
              className="w-full rounded-[10px] border border-tinta-100 bg-tinta-50 py-2 pl-9 pr-3 text-sm focus:border-ajarin-500 focus:outline-none focus:ring-2 focus:ring-ajarin-500/20"
            />
          </div>
          )}
          <ul
            ref={daftarRef}
            id={idDaftar}
            role="listbox"
            aria-label={label ?? 'Pilihan'}
            // Tanpa kolom cari, daftar sendiri yang menerima fokus dan tombol panah/Enter/Esc.
            tabIndex={cari ? undefined : -1}
            aria-activedescendant={!cari && datar[aktif] ? `${idDaftar}-${aktif}` : undefined}
            onKeyDown={cari ? undefined : tombolKeyboard}
            className="max-h-64 overflow-y-auto py-1 focus:outline-none"
          >
            {tersaring.length === 0 && <li className="px-4 py-3 text-sm text-tinta-500">Tidak ada yang cocok dengan “{kueri}”.</li>}
            {tersaring.map((g, gi) => (
              <li key={g.label ?? gi} role="presentation">
                {g.label && <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-tinta-500">{g.label}</p>}
                <ul role="group" aria-label={g.label}>
                  {g.opsi.map((o) => {
                    urut += 1;
                    const n = urut;
                    const dipilih = o.nilai === value;
                    return (
                      <li
                        key={`${g.label}-${o.nilai}`}
                        id={`${idDaftar}-${n}`}
                        data-urut={n}
                        role="option"
                        aria-selected={dipilih}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => pilih(o.nilai)}
                        onMouseEnter={() => setAktif(n)}
                        className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm ${aktif === n ? 'bg-ajarin-50' : ''} ${
                          dipilih ? 'font-semibold text-ajarin-600' : 'text-tinta-900'
                        }`}
                      >
                        <span className="min-w-0 truncate">{o.label}</span>
                        {dipilih && <span aria-hidden="true">✓</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {aksi && (
            <button
              type="button"
              onClick={() => {
                setBuka(false);
                aksi.onPilih();
              }}
              className="w-full border-t border-tinta-100 px-4 py-2.5 text-left text-sm font-semibold text-ajarin-600 hover:bg-ajarin-50"
            >
              {aksi.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Dropdown mata pelajaran sesuai jenjang (bisa dicari), dengan "Lainnya" untuk mengetik sendiri. */
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
  return (
    <div className="space-y-2">
      <PilihCari
        id={id}
        value={lain ? '' : value}
        onChange={(v) => {
          setKetik(false);
          onChange(v);
        }}
        grup={[{ opsi: daftar }]}
        placeholder={lain ? 'Lainnya (ketik sendiri)' : 'Pilih mata pelajaran'}
        galat={!!galat}
        aksi={{
          label: 'Lainnya (ketik sendiri)',
          onPilih: () => {
            setKetik(true);
            onChange('');
          },
        }}
      />
      {lain && (
        <input
          aria-label="Nama mata pelajaran lainnya"
          required
          minLength={2}
          maxLength={80}
          placeholder="Tulis nama mata pelajaran"
          className={propsKontrol(`${id}-lain`, galat).className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
