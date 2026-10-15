import { useEffect, useState } from 'react';
import { Ikon } from './ui';

/**
 * Membagi daftar panjang (mis. siswa) per halaman supaya tabel tidak memanjang ribuan baris.
 * `kunci` berubah (mis. kata cari atau kelas lain) -> kembali ke halaman 1.
 */
export function usePaging<T>(daftar: T[], perHalaman = 25, kunci?: unknown) {
  const [halaman, setHalaman] = useState(1);
  const jumlahHalaman = Math.max(1, Math.ceil(daftar.length / perHalaman));

  useEffect(() => setHalaman(1), [kunci]);
  // Daftar memendek (mis. siswa dihapus): jangan tertinggal di halaman yang sudah tidak ada.
  useEffect(() => {
    if (halaman > jumlahHalaman) setHalaman(jumlahHalaman);
  }, [halaman, jumlahHalaman]);

  const awal = (Math.min(halaman, jumlahHalaman) - 1) * perHalaman;
  return {
    tampil: daftar.slice(awal, awal + perHalaman),
    /** Nomor urut baris pertama di halaman ini dikurangi 1 (untuk kolom No). */
    awal,
    halaman: Math.min(halaman, jumlahHalaman),
    jumlahHalaman,
    total: daftar.length,
    perHalaman,
    ke: (n: number) => setHalaman(Math.min(Math.max(1, n), jumlahHalaman)),
  };
}

type Paging = ReturnType<typeof usePaging>;

/** Navigasi halaman di bawah tabel; tidak tampil bila semua baris muat dalam satu halaman. */
export function NavHalaman({ paging, satuan = 'siswa' }: { paging: Paging; satuan?: string }) {
  if (paging.jumlahHalaman <= 1) return null;
  const { halaman, jumlahHalaman, awal, total, tampil } = paging;
  return (
    <nav aria-label="Halaman tabel" className="mt-3 flex flex-col items-center justify-between gap-2 text-sm sm:flex-row">
      <p className="text-tinta-500" aria-live="polite">
        Menampilkan {awal + 1}–{awal + tampil.length} dari {total} {satuan}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => paging.ke(halaman - 1)}
          disabled={halaman <= 1}
          aria-label="Halaman sebelumnya"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-tinta-100 text-ajarin-600 hover:bg-ajarin-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Ikon nama="kiri" className="h-4 w-4" />
        </button>
        <span className="min-w-[7rem] text-center font-semibold text-tinta-900">
          Halaman {halaman} / {jumlahHalaman}
        </span>
        <button
          type="button"
          onClick={() => paging.ke(halaman + 1)}
          disabled={halaman >= jumlahHalaman}
          aria-label="Halaman berikutnya"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-tinta-100 text-ajarin-600 hover:bg-ajarin-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Ikon nama="kanan" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
