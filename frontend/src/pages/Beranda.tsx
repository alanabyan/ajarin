import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo, Pesan } from '../components/ui';
import { pesanError } from '../lib/api';
import { useAuth } from '../lib/auth';

const MASALAH = [
  {
    judul: 'Administrasi menyita waktu',
    isi: 'Modul ajar, soal ulangan, dan rekap nilai disusun manual berjam-jam. Waktu itu seharusnya untuk menyiapkan pembelajaran dan mendampingi siswa.',
  },
  {
    judul: 'Dukungan yang timpang',
    isi: 'Guru honorer sering bekerja dengan fasilitas terbatas, sehingga mutu perangkat ajar sangat bergantung pada waktu luang pribadi.',
  },
  {
    judul: 'Alat yang terpisah-pisah',
    isi: 'Dokumen di satu aplikasi, soal di aplikasi lain, nilai di buku catatan. Tidak ada alur yang menyambung perencanaan sampai evaluasi.',
  },
];

const FITUR = [
  {
    judul: 'Modul ajar dalam hitungan menit',
    isi: 'Isi topik, kelas, dan tujuan pembelajaran. Draf modul Kurikulum Merdeka tersusun lengkap, bisa disunting, dan dicetak sebagai PDF.',
  },
  {
    judul: 'Bank soal dengan pembahasan',
    isi: 'Soal pilihan ganda lengkap dengan kunci dan pembahasan. Koreksi langsung, lalu bagikan sebagai kuis Google Form atau berkas Kahoot.',
  },
  {
    judul: 'Nilai masuk otomatis',
    isi: 'Hasil kuis diimpor ke rekap kelas. Siswa memilih namanya dari dropdown di form, dan impor ulang memperbarui nilai tanpa menggandakannya.',
  },
  {
    judul: 'Tahu materi mana yang belum dikuasai',
    isi: 'Analisis butir soal menunjukkan soal yang paling banyak dijawab salah, sehingga guru tahu apa yang perlu diulang. Rekap menandai siswa yang perlu remedial berdasarkan KKM.',
  },
];

const LANGKAH = [
  ['1', 'Rancang', 'Buat modul ajar dari topik dan tujuan pembelajaran.'],
  ['2', 'Ujikan', 'Susun soal dan bagikan sebagai Google Form atau Kahoot.'],
  ['3', 'Tindak lanjuti', 'Impor hasil ke rekap kelas dan lihat materi yang perlu diulang.'],
];

export default function Beranda() {
  const { user, masukDemo } = useAuth();
  const navigate = useNavigate();
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');

  async function coba() {
    setGalat('');
    setMemuat(true);
    try {
      await masukDemo();
      navigate('/dashboard');
    } catch (e) {
      setGalat(pesanError(e, 'Akun demo belum bisa dibuka. Coba lagi sebentar.'));
    } finally {
      setMemuat(false);
    }
  }

  return (
    <div className="min-h-screen bg-kertas">
      <header className="sticky top-0 z-20 border-b border-tinta-100 bg-kertas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2 text-sm" aria-label="Akun">
            {user ? (
              <Link to="/dashboard" className="btn-utama">
                Buka dashboard
              </Link>
            ) : (
              <>
                <Link to="/masuk" className="btn text-tinta-700 hover:bg-tinta-50">
                  Masuk
                </Link>
                <Link to="/daftar" className="btn-utama">
                  Daftar
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-ajarin-500 text-white">
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
            <p className="mb-5 inline-block rounded-full bg-white/15 px-3 py-1 text-xs text-ajarin-100 sm:text-sm">
              SDG 4 · Pendidikan Berkualitas
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Penerang jalan guru <span className="text-ajarin-200">mengajar</span>.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-white/75 sm:text-lg">
              Ajarin membantu guru honorer menyusun modul ajar, membuat bank soal, dan merekap nilai dalam satu
              alur, supaya waktu lebih banyak untuk siswa.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={coba} disabled={memuat} className="btn bg-white px-6 py-3 text-base text-ajarin-600 hover:bg-ajarin-50">
                {memuat ? 'Membuka demo...' : 'Coba demo tanpa daftar'}
              </button>
              <Link
                to="/daftar"
                className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10"
              >
                Buat akun gratis
              </Link>
            </div>
            {galat && (
              <div className="mt-4 max-w-md">
                <Pesan nada="galat">{galat}</Pesan>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="mb-2 text-2xl font-semibold sm:text-3xl">Masalah yang kami jawab</h2>
          <p className="mb-8 max-w-2xl text-tinta-500">
            Mutu pendidikan bergantung pada guru. Ketika guru kewalahan oleh administrasi, yang berkurang adalah waktu
            untuk siswa.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {MASALAH.map((m) => (
              <div key={m.judul} className="kartu">
                <h3 className="mb-2 text-lg font-semibold">{m.judul}</h3>
                <p className="text-sm text-tinta-700">{m.isi}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-tinta-100 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="mb-2 text-2xl font-semibold sm:text-3xl">Satu alur dari perencanaan sampai evaluasi</h2>
            <p className="mb-8 max-w-2xl text-tinta-500">Fitur utama yang saling menyambung.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {FITUR.map((f) => (
                <div key={f.judul} className="rounded-xl border border-tinta-100 bg-kertas p-6">
                  <h3 className="mb-2 text-lg font-semibold text-tinta-700">{f.judul}</h3>
                  <p className="text-sm text-tinta-700">{f.isi}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="mb-8 text-2xl font-semibold sm:text-3xl">Cara kerjanya</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {LANGKAH.map(([no, judul, isi]) => (
              <li key={no} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ajarin-100 font-display text-lg font-semibold text-ajarin-600">
                  {no}
                </span>
                <div>
                  <p className="font-semibold">{judul}</p>
                  <p className="mt-1 text-sm text-tinta-700">{isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-ajarin-50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="mb-3 text-2xl font-semibold sm:text-3xl">Kontribusi pada SDG 4</h2>
            <p className="max-w-3xl text-tinta-700">
              Ajarin mendukung target 4.c, yaitu meningkatkan jumlah guru yang berkualitas. Dengan perangkat ajar
              yang lebih cepat disusun dan lebih rapi, guru honorer dapat mengajar dengan persiapan yang sama baiknya
              dengan rekan yang punya lebih banyak dukungan. Hasilnya adalah pembelajaran yang lebih merata bagi siswa.
            </p>
            <button type="button" onClick={coba} disabled={memuat} className="btn-utama mt-6 px-6 py-3">
              {memuat ? 'Membuka demo...' : 'Buka akun demo'}
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-tinta-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-tinta-500 sm:flex-row sm:justify-between sm:px-6">
          <span>© 2026 Ajarin. Penerang jalan guru mengajar.</span>
          <Link to="/privasi" className="hover:underline">
            Kebijakan privasi
          </Link>
        </div>
      </footer>
    </div>
  );
}
