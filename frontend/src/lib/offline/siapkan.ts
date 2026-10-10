import type { AxiosInstance } from 'axios';
import { kunciCache, type EntriCache } from './cacheApi';
import { ambilStatus, ubahStatus } from './jaringan';
import type { Penyimpanan } from './penyimpanan';

// Menyiapkan data untuk mode offline: saat online, daftar dan detail milik guru diambil di latar belakang lewat
// api yang sama (jadi otomatis tersimpan oleh interceptor cache). Batas jumlah menjaga pemakaian kuota data.

const JEDA_MINIMAL = 15 * 60 * 1000;
const MAKS_DETAIL = 50;
const MAKS_RAPOR = 150;
const MAKS_SEGARKAN = 80;
const PARALEL = 3;

const kunciWaktu = (id: string) => `offline-siap:${id}`;

const bacaWaktu = (id: string): number | null => {
  try {
    const n = Number(localStorage.getItem(kunciWaktu(id)));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
};

const tulisWaktu = (id: string, t: number) => {
  try {
    localStorage.setItem(kunciWaktu(id), String(t));
  } catch {
    /* penyimpanan tidak tersedia */
  }
};

/** Menjalankan `fn` untuk semua item dengan paling banyak `n` sekaligus; berhenti bila `lanjut()` bernilai false. */
async function paralel<T>(item: T[], n: number, lanjut: () => boolean, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, item.length) }, async () => {
      while (i < item.length && lanjut()) await fn(item[i++]);
    })
  );
}

export interface Penyiap {
  siapkanOffline(opsi?: { paksa?: boolean }): Promise<void>;
  segarkanSetelahUbah(urlMutasi: string): void;
  hapusDataOffline(): Promise<void>;
  /** Memuat waktu penyiapan terakhir milik akun aktif ke status (dipanggil saat aplikasi dibuka). */
  muatStatus(): void;
}

export function buatPenyiap(api: AxiosInstance, simpanan: Penyimpanan, idPengguna: () => string | null): Penyiap {
  let sedang = false;

  async function siapkanOffline({ paksa = false } = {}) {
    const id = idPengguna();
    if (!id || sedang || !ambilStatus().online) return;
    if (!paksa) {
      const terakhir = bacaWaktu(id);
      if (terakhir && Date.now() - terakhir < JEDA_MINIMAL) {
        ubahStatus({ terakhirSiap: terakhir });
        return;
      }
    }

    sedang = true;
    let selesai = 0;
    let total = 0;
    const lapor = () => ubahStatus({ progres: { selesai, total } });
    const tambahTotal = (n: number) => {
      total += n;
      lapor();
    };
    const masihOnline = () => ambilStatus().online && idPengguna() === id;
    const ambil = async (url: string): Promise<any> => {
      try {
        return (await api.get(url)).data;
      } catch {
        return null;
      } finally {
        selesai++;
        lapor();
      }
    };

    ubahStatus({ menyiapkan: true, progres: { selesai: 0, total: 0 } });
    try {
      tambahTotal(5);
      const [modul, soal, kelas] = await Promise.all([ambil('/modul'), ambil('/soal'), ambil('/kelas'), ambil('/dampak'), ambil('/auth/saya')]);
      if (!masihOnline()) return;

      const urlDetail: string[] = [
        ...((modul?.modul ?? []) as { id: string }[]).slice(0, MAKS_DETAIL).map((m) => `/modul/${m.id}`),
        ...((soal?.set ?? []) as { id: string }[]).slice(0, MAKS_DETAIL).map((s) => `/soal/${s.id}`),
      ];
      const kelasIds = ((kelas?.kelas ?? []) as { id: string }[]).slice(0, MAKS_DETAIL).map((k) => k.id);
      tambahTotal(urlDetail.length + kelasIds.length * 2);

      await paralel(urlDetail, PARALEL, masihOnline, async (u) => void (await ambil(u)));

      // Detail kelas memuat daftar siswa, yang dibutuhkan untuk mengambil rapor tiap siswa.
      const urlRapor: string[] = [];
      await paralel(kelasIds, PARALEL, masihOnline, async (kid) => {
        const [detail] = await Promise.all([ambil(`/kelas/${kid}`), ambil(`/kelas/${kid}/rekap`)]);
        for (const s of (detail?.siswa ?? []) as { id: string }[]) urlRapor.push(`/kelas/siswa/${s.id}/rapor`);
      });
      const rapor = urlRapor.slice(0, MAKS_RAPOR);
      tambahTotal(rapor.length);
      await paralel(rapor, PARALEL, masihOnline, async (u) => void (await ambil(u)));

      if (masihOnline()) {
        const sekarang = Date.now();
        tulisWaktu(id, sekarang);
        ubahStatus({ terakhirSiap: sekarang });
      }
    } finally {
      sedang = false;
      ubahStatus({ menyiapkan: false });
    }
  }

  // Setelah guru mengubah sesuatu (membuat modul, menyimpan nilai, ...), data offline yang terdampak disegarkan
  // supaya tidak basi. Digabung (debounce) agar beberapa perubahan beruntun hanya memicu satu putaran.
  const tertunda = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function segarkanSetelahUbah(urlMutasi: string) {
    const keluarga = /^\/(modul|soal|kelas)(\/|$)/.exec(urlMutasi)?.[1];
    if (!keluarga) return;
    tertunda.add(keluarga);
    clearTimeout(timer);
    timer = setTimeout(() => void jalankanSegarkan(), 3000);
  }

  async function jalankanSegarkan() {
    const keluarga = [...tertunda];
    tertunda.clear();
    const id = idPengguna();
    if (!id || !ambilStatus().online) return;

    const sasaran = new Map<string, EntriCache>();
    const tambah = (e: EntriCache) => sasaran.set(kunciCache(id, e.url, e.params), e);
    for (const k of keluarga) {
      tambah({ url: `/${k}`, data: null, tersimpan: 0 });
      for (const kunci of await simpanan.kunci(`${id}|/${k}`)) {
        const e = await simpanan.ambil<EntriCache>(kunci);
        if (e) tambah(e);
      }
    }
    if (keluarga.some((k) => k !== 'modul')) tambah({ url: '/dampak', data: null, tersimpan: 0 });

    await paralel([...sasaran.entries()].slice(0, MAKS_SEGARKAN), PARALEL, () => ambilStatus().online, async ([kunci, e]) => {
      try {
        await api.get(e.url, { params: e.params as Record<string, unknown> | undefined });
      } catch (err) {
        // Data yang sudah dihapus tidak perlu disimpan lagi.
        if ((err as { response?: { status?: number } }).response?.status === 404) await simpanan.hapus(kunci);
      }
    });
    const sekarang = Date.now();
    tulisWaktu(id, sekarang);
    ubahStatus({ terakhirSiap: sekarang });
  }

  async function hapusDataOffline() {
    clearTimeout(timer);
    tertunda.clear();
    await simpanan.hapusSemua();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('offline-siap:'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* penyimpanan tidak tersedia */
    }
    ubahStatus({ terakhirSiap: null, progres: { selesai: 0, total: 0 } });
  }

  function muatStatus() {
    const id = idPengguna();
    ubahStatus({ terakhirSiap: id ? bacaWaktu(id) : null });
  }

  return { siapkanOffline, segarkanSetelahUbah, hapusDataOffline, muatStatus };
}
