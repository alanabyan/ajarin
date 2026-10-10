// Penyimpanan kunci-nilai sederhana di IndexedDB untuk data mode offline. Semua operasi tahan galat: bila
// IndexedDB tidak tersedia (mode privat, diblokir, penyimpanan penuh) ATAU menggantung tanpa pernah menjawab,
// operasi diam-diam tidak berefek dan aplikasi tetap berjalan seperti biasa, hanya tanpa mode offline.
// Batas waktu itu penting: cache dipakai di jalur galat jaringan, jadi IndexedDB yang macet tidak boleh ikut
// membuat permintaan aplikasi macet.

export interface Penyimpanan {
  ambil<T>(kunci: string): Promise<T | undefined>;
  simpan(kunci: string, nilai: unknown): Promise<void>;
  hapus(kunci: string): Promise<void>;
  /** Semua kunci yang berawalan `prefiks`. */
  kunci(prefiks: string): Promise<string[]>;
  hapusSemua(): Promise<void>;
}

const STORE = 'respons';
/** Berapa lama satu operasi ditunggu sebelum dianggap gagal. */
const BATAS_WAKTU = 4000;
/** Setelah pembukaan menggantung, selama ini tidak dicoba lagi (operasi langsung gagal, tanpa menunggu). */
const JEDA_COBA_ULANG = 30_000;

export function bukaIdb(namaDb = 'pelita-guru-offline', batasWaktu = BATAS_WAKTU, jedaCobaUlang = JEDA_COBA_ULANG): Penyimpanan {
  let db: IDBDatabase | null = null;
  let membuka: Promise<IDBDatabase | null> | null = null;
  let jedaSampai = 0;

  const batas = <T>(p: Promise<T>, galat: T): Promise<T> =>
    new Promise((resolve) => {
      const t = setTimeout(() => resolve(galat), batasWaktu);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        () => {
          clearTimeout(t);
          resolve(galat);
        }
      );
    });

  const bukaKoneksi = (): Promise<IDBDatabase | null> =>
    new Promise((resolve) => {
      try {
        const req = indexedDB.open(namaDb, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => {
          db = req.result; // bila baru berhasil setelah batas waktu lewat, tetap dipakai untuk operasi berikutnya
          db.onclose = () => (db = null);
          db.onversionchange = () => {
            db?.close();
            db = null;
          };
          resolve(db);
        };
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

  const buka = async (): Promise<IDBDatabase | null> => {
    if (db) return db;
    if (Date.now() < jedaSampai) return null;
    membuka ??= bukaKoneksi().finally(() => (membuka = null));
    const hasil = await batas(membuka, null);
    if (!hasil && !db) jedaSampai = Date.now() + jedaCobaUlang;
    return hasil ?? db;
  };

  // Menjalankan satu operasi pada object store; hasilnya `galat` bila apa pun gagal atau terlalu lama.
  async function jalankan<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest, galat: T): Promise<T> {
    const koneksi = await buka();
    if (!koneksi) return galat;
    return batas(
      new Promise<T>((resolve) => {
        try {
          const tx = koneksi.transaction(STORE, mode);
          const req = op(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req.result as T);
          tx.onerror = () => resolve(galat);
          tx.onabort = () => resolve(galat);
        } catch {
          resolve(galat);
        }
      }),
      galat
    );
  }

  return {
    ambil: <T>(kunci: string) => jalankan<T | undefined>('readonly', (s) => s.get(kunci), undefined),
    simpan: async (kunci, nilai) => {
      await jalankan('readwrite', (s) => s.put(nilai, kunci), undefined);
    },
    hapus: async (kunci) => {
      await jalankan('readwrite', (s) => s.delete(kunci), undefined);
    },
    kunci: async (prefiks) =>
      (await jalankan<IDBValidKey[]>('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(prefiks, `${prefiks}￿`)), [])).map(String),
    hapusSemua: async () => {
      await jalankan('readwrite', (s) => s.clear(), undefined);
    },
  };
}
