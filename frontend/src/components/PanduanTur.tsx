import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Langkah tur. `target` memakai atribut data-tour di Layout; tanpa target, kartu tampil di tengah layar.
// `sidebar`: elemennya ada di menu samping, yang tersembunyi di HP/tablet sehingga perlu dibuka dulu.
interface Langkah {
  target?: string;
  sidebar?: boolean;
  judul: string;
  isi: string;
}

const LANGKAH: Langkah[] = [
  {
    judul: 'Selamat datang di Ajarin',
    isi: 'Tur singkat ini mengenalkan fitur-fitur utama, dari menyusun modul ajar sampai membaca hasil belajar siswa. Hanya sekitar satu menit.',
  },
  {
    target: 'menu-beranda',
    sidebar: true,
    judul: 'Beranda',
    isi: 'Ringkasan aktivitas Anda: kelas, set soal, dan modul terbaru, plus pintasan untuk membuat yang baru.',
  },
  {
    target: 'menu-modul',
    sidebar: true,
    judul: 'Modul Ajar',
    isi: 'Isi kelas, semester, cakupan materi, dan tujuan pembelajaran. AI menyusun rencana satu semester lengkap dengan tabel tiap pertemuan, bisa disunting, dicetak, atau diunduh sebagai Word.',
  },
  {
    target: 'menu-soal',
    sidebar: true,
    judul: 'Bank Soal',
    isi: 'Buat soal pilihan ganda lengkap dengan kunci dan pembahasan, lalu bagikan sebagai kuis Google Form atau berkas Kahoot.',
  },
  {
    target: 'menu-kelas',
    sidebar: true,
    judul: 'Kelas & Nilai',
    isi: 'Buat kelas dengan nama baku (mis. X RPL 1), kelola daftar siswa, dan rekap nilai. Hasil kuis Google Form bisa diimpor otomatis, dan siswa di bawah KKM langsung ditandai.',
  },
  {
    target: 'menu-dampak',
    sidebar: true,
    judul: 'Dampak & Peta Belajar',
    isi: 'Lihat soal yang paling banyak dijawab salah, sehingga Anda tahu materi mana yang perlu diulang.',
  },
  {
    target: 'cari',
    judul: 'Pencarian cepat',
    isi: 'Cari modul, soal, dan kelas sekaligus dari halaman mana pun; hasilnya muncul langsung di bawah kolom. Kata kunci boleh diketik acak, mis. "matematika ganjil".',
  },
  {
    target: 'offline',
    sidebar: true,
    judul: 'Bisa dipakai offline',
    isi: 'Ajarin menyimpan data Anda di perangkat. Saat sinyal hilang, modul, soal, dan nilai tetap bisa dibuka.',
  },
  {
    target: 'akun',
    judul: 'Akun dan tombol Keluar',
    isi: 'Klik nama atau inisial Anda di sini untuk melihat akun dan menekan Keluar. Jangan lupa keluar bila memakai perangkat bersama.',
  },
  {
    target: 'panduan',
    judul: 'Butuh panduan lagi?',
    isi: 'Tombol ini membuka kembali tur kapan saja. Selamat mengajar!',
  },
];

const KUNCI = (idUser: string) => `ajarin.tur.${idUser}`;

export function turSudahDilihat(idUser: string): boolean {
  try {
    return localStorage.getItem(KUNCI(idUser)) === '1';
  } catch {
    return false;
  }
}

export function tandaiTurDilihat(idUser: string) {
  try {
    localStorage.setItem(KUNCI(idUser), '1');
  } catch {
    /* penyimpanan diblokir: tur akan muncul lagi di kunjungan berikutnya, tidak fatal */
  }
}

interface Kotak {
  top: number;
  left: number;
  width: number;
  height: number;
}

const LEBAR_KARTU = 340;
const JARAK = 12;
const PAD = 6;

function cariTarget(nama?: string): HTMLElement | null {
  if (!nama) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${nama}"]`);
  // Elemen yang tersembunyi (display:none) tidak punya ukuran.
  return el && el.getClientRects().length > 0 ? el : null;
}

export default function PanduanTur({
  buka,
  onTutup,
  onBukaMenu,
}: {
  buka: boolean;
  onTutup: () => void;
  onBukaMenu: (terbuka: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [kotak, setKotak] = useState<Kotak | null>(null);
  const [tinggiKartu, setTinggiKartu] = useState(200);
  const kartu = useRef<HTMLDivElement>(null);
  const tombolLanjut = useRef<HTMLButtonElement>(null);

  // Langkah yang targetnya tidak ada di layar dilewati.
  const [daftar, setDaftar] = useState(LANGKAH);
  useEffect(() => {
    if (!buka) return;
    setI(0);
    setDaftar(LANGKAH);
  }, [buka]);

  const langkah = daftar[i];
  const terakhir = i === daftar.length - 1;

  // Buka/tutup menu samping sesuai langkah (hanya berefek di layar kecil).
  useEffect(() => {
    if (!buka || !langkah) return;
    onBukaMenu(!!langkah.sidebar);
  }, [buka, i]); // eslint-disable-line react-hooks/exhaustive-deps

  const ukur = useCallback(() => {
    const el = cariTarget(langkah?.target);
    if (!el) return setKotak(null);
    const r = el.getBoundingClientRect();
    setKotak({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [langkah]);

  useEffect(() => {
    if (!buka || !langkah) return;
    // Menu samping punya animasi geser; tunggu selesai sebelum mengukur.
    const el = cariTarget(langkah.target);
    el?.scrollIntoView({ block: 'nearest' });
    ukur();
    const t = window.setTimeout(ukur, 350);
    window.addEventListener('resize', ukur);
    window.addEventListener('scroll', ukur, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', ukur);
      window.removeEventListener('scroll', ukur, true);
    };
  }, [buka, i, langkah, ukur]);

  // Target yang tak ditemukan setelah menu terbuka (mis. layar sempit): lewati langkahnya.
  useEffect(() => {
    if (!buka || !langkah?.target) return;
    const t = window.setTimeout(() => {
      if (!cariTarget(langkah.target)) {
        setDaftar((d) => d.filter((l) => l !== langkah));
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [buka, langkah]);

  useLayoutEffect(() => {
    if (kartu.current) setTinggiKartu(kartu.current.offsetHeight);
  });

  useEffect(() => {
    if (buka) tombolLanjut.current?.focus();
  }, [buka, i]);

  const selesai = useCallback(() => {
    onBukaMenu(false);
    onTutup();
  }, [onBukaMenu, onTutup]);

  useEffect(() => {
    if (!buka) return;
    function tombol(e: KeyboardEvent) {
      if (e.key === 'Escape') selesai();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, daftar.length - 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    }
    window.addEventListener('keydown', tombol);
    return () => window.removeEventListener('keydown', tombol);
  }, [buka, daftar.length, selesai]);

  if (!buka || !langkah) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hp = vw < 640;

  // Posisi kartu: di HP menempel atas/bawah layar (menjauhi target); di layar lebar di samping/bawah target.
  let gaya: React.CSSProperties;
  if (!kotak) {
    gaya = { top: Math.max(16, (vh - tinggiKartu) / 2), left: Math.max(16, (vw - Math.min(LEBAR_KARTU, vw - 32)) / 2), width: Math.min(LEBAR_KARTU, vw - 32) };
  } else if (hp) {
    const diBawah = kotak.top + kotak.height / 2 > vh / 2;
    gaya = { left: 16, right: 16, ...(diBawah ? { top: 16 } : { bottom: 16 }) };
  } else {
    const lebar = LEBAR_KARTU;
    const kanan = kotak.left + kotak.width + JARAK + PAD;
    let top: number;
    let left: number;
    if (kanan + lebar + 16 <= vw && kotak.left < vw / 2) {
      left = kanan;
      top = kotak.top + kotak.height / 2 - tinggiKartu / 2;
    } else {
      left = kotak.left + kotak.width / 2 - lebar / 2;
      top = kotak.top + kotak.height + JARAK + PAD;
      if (top + tinggiKartu > vh - 16) top = kotak.top - tinggiKartu - JARAK - PAD;
    }
    gaya = {
      width: lebar,
      left: Math.min(Math.max(16, left), vw - lebar - 16),
      top: Math.min(Math.max(16, top), vh - tinggiKartu - 16),
    };
  }

  return (
    <div className="tanpa-cetak fixed inset-0 z-[60]">
      {/* Penghalang klik: selama tur, halaman di belakang tidak bisa diklik. */}
      <div className="absolute inset-0" onClick={selesai} aria-hidden="true" />
      {kotak ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[16px] shadow-[0_0_0_9999px_rgba(29,28,86,0.7)] ring-2 ring-white transition-all duration-200"
          style={{ top: kotak.top - PAD, left: kotak.left - PAD, width: kotak.width + PAD * 2, height: kotak.height + PAD * 2 }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-ajarin-700/70" />
      )}

      <div
        ref={kartu}
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-tur"
        aria-describedby="isi-tur"
        className="absolute rounded-[14px] bg-white p-5 text-tinta-900 shadow-kartu"
        style={gaya}
      >
        <p className="text-xs font-semibold text-ajarin-500">
          Langkah {i + 1} dari {daftar.length}
        </p>
        <h2 id="judul-tur" className="mt-1 text-lg font-bold text-ajarin-600">
          {langkah.judul}
        </h2>
        <p id="isi-tur" className="mt-2 text-sm leading-relaxed text-tinta-700">
          {langkah.isi}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {daftar.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-ajarin-500' : 'w-1.5 bg-ajarin-200'}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={selesai} className="text-sm font-semibold text-tinta-500 hover:underline">
            {terakhir ? 'Tutup' : 'Lewati'}
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="btn-garis px-4 py-2 text-sm">
                Kembali
              </button>
            )}
            <button
              ref={tombolLanjut}
              type="button"
              onClick={() => (terakhir ? selesai() : setI(i + 1))}
              className="btn-utama px-5 py-2 text-sm"
            >
              {terakhir ? 'Selesai' : i === 0 ? 'Mulai tur' : 'Lanjut'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
