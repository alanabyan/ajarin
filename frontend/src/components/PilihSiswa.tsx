import { useEffect, useMemo, useRef, useState } from 'react';

/** Pilihan banyak baris (mis. siswa) untuk aksi sekaligus. Id yang sudah tidak ada di daftar otomatis dilepas. */
export function usePilihan(ids: string[]) {
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const kunci = ids.join('|');

  useEffect(() => {
    setTerpilih((lama) => {
      const ada = new Set(ids);
      const baru = new Set([...lama].filter((id) => ada.has(id)));
      return baru.size === lama.size ? lama : baru;
    });
  }, [kunci]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    const semua = ids.length > 0 && ids.every((id) => terpilih.has(id));
    return {
      terpilih,
      jumlah: terpilih.size,
      semua,
      sebagian: terpilih.size > 0 && !semua,
      ada: (id: string) => terpilih.has(id),
      ubah: (id: string) =>
        setTerpilih((lama) => {
          const baru = new Set(lama);
          if (baru.has(id)) baru.delete(id);
          else baru.add(id);
          return baru;
        }),
      // Centang semua = semua baris yang sedang tampil (mis. hasil pencarian), bukan seluruh kelas.
      ubahSemua: () => setTerpilih(semua ? new Set() : new Set(ids)),
      kosongkan: () => setTerpilih(new Set()),
    };
  }, [ids, terpilih]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Kotak centang "pilih semua" dengan keadaan sebagian (indeterminate). */
export function CentangSemua({ semua, sebagian, onChange, label }: { semua: boolean; sebagian: boolean; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = sebagian;
  }, [sebagian]);
  return <input ref={ref} type="checkbox" aria-label={label} checked={semua} onChange={onChange} className="h-4 w-4 cursor-pointer accent-ajarin-500" />;
}

export function Centang({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} className="h-4 w-4 cursor-pointer accent-ajarin-500" />;
}

/** Bilah aksi yang muncul saat ada siswa terpilih. */
export function BilahTerpilih({ jumlah, sibuk, onHapus, onBatal }: { jumlah: number; sibuk: boolean; onHapus: () => void; onBatal: () => void }) {
  if (jumlah === 0) return null;
  return (
    <div role="region" aria-label="Aksi siswa terpilih" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm">
      <span className="font-semibold text-red-800" aria-live="polite">
        {jumlah} siswa dipilih
      </span>
      <button type="button" onClick={onHapus} disabled={sibuk} className="btn-bahaya ml-auto px-4 py-1.5 text-xs">
        {sibuk ? 'Menghapus...' : `Hapus ${jumlah} siswa`}
      </button>
      <button type="button" onClick={onBatal} disabled={sibuk} className="text-xs font-semibold text-tinta-500 hover:underline">
        Batal pilih
      </button>
    </div>
  );
}
