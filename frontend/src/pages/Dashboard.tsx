import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ikon, Memuat, Sampul, angka } from '../components/ui';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import type { KelasRingkas, ModulRingkas, SetSoalRingkas } from '../types';

interface Data {
  modul: ModulRingkas[];
  soal: SetSoalRingkas[];
  kelas: KelasRingkas[];
  bernilai: number;
}

const EMAIL_DEMO = 'demo@pelitaguru.id';
const KUNCI_TUTUP = 'panduan-ditutup';

const bacaTutup = (): boolean => {
  try {
    return localStorage.getItem(KUNCI_TUTUP) === '1';
  } catch {
    return false;
  }
};

interface Langkah {
  ke: string;
  judul: string;
  isi: string;
  selesai: boolean;
}

// Panduan awal: guru baru melihat 4 langkah dengan tanda selesai; akun demo (juri) melihat jalur singkat ke fitur utama.
function Panduan({ langkah, demo }: { langkah: Langkah[]; demo: boolean }) {
  const [tutup, setTutup] = useState(bacaTutup);
  const selesai = langkah.filter((l) => l.selesai).length;
  if (tutup || (!demo && selesai === langkah.length)) return null;

  function sembunyikan() {
    setTutup(true);
    try {
      localStorage.setItem(KUNCI_TUTUP, '1');
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }

  return (
    <section className="kartu" aria-labelledby="judul-panduan">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="judul-panduan" className="text-lg font-bold">
            {demo ? 'Panduan singkat untuk juri' : 'Mulai dalam 4 langkah'}
          </h2>
          <p className="mt-0.5 text-sm text-tinta-500">
            {demo
              ? 'Akun ini sudah berisi data contoh. Ikuti urutan berikut untuk melihat alur utama dalam beberapa menit.'
              : `${selesai} dari ${langkah.length} langkah selesai.`}
          </p>
        </div>
        <button type="button" onClick={sembunyikan} className="shrink-0 text-xs text-tinta-500 hover:underline">
          Sembunyikan
        </button>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {langkah.map((l, i) => (
          <li key={l.ke}>
            <Link to={l.ke} className="flex h-full gap-3 rounded-xl border border-tinta-100 p-3 transition-colors hover:border-ajarin-500">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  l.selesai && !demo ? 'bg-emerald-600 text-white' : 'bg-ajarin-50 text-ajarin-600'
                }`}
              >
                {l.selesai && !demo ? '✓' : i + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  {l.judul}
                  {l.selesai && !demo && <span className="sr-only"> (selesai)</span>}
                </span>
                <span className="block text-sm text-tinta-500">{l.isi}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

const tanggalPanjang = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

function salam(): string {
  const j = new Date().getHours();
  if (j < 11) return 'Selamat Pagi';
  if (j < 15) return 'Selamat Siang';
  if (j < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    Promise.all([api.get('/modul'), api.get('/soal'), api.get('/kelas'), api.get('/dampak').catch(() => null)])
      .then(([m, s, k, p]) =>
        setD({
          bernilai: p?.data.ringkasan.siswaBerNilai ?? 0,
          modul: m.data.modul,
          soal: s.data.set,
          kelas: k.data.kelas,
        })
      )
      .catch(() => setD({ modul: [], soal: [], kelas: [], bernilai: 0 }));
  }, []);

  if (!d) return <Memuat />;

  const siswa = d.kelas.reduce((t, x) => t + x.jumlahSiswa, 0);
  // Perkiraan kasar, bukan pengukuran: asumsi modul ±45 menit dan satu set soal ±30 menit bila disusun manual.
  const menit = d.modul.length * 45 + d.soal.length * 30;
  const hemat = menit >= 60 ? `${Math.floor(menit / 60)} jam ${menit % 60} menit` : `${menit} menit`;
  const demo = user?.email === EMAIL_DEMO;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
        <section className="relative flex min-h-[170px] items-center overflow-hidden rounded-[14px] bg-gradient-to-r from-[#7C7CFF] to-[#1D1DCF] p-6 text-white sm:p-8">
          <div className="relative z-10 sm:max-w-[48%]">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {salam()}, {user?.nama.split(' ')[0]}
            </h1>
            <p className="mt-2 text-sm text-white/90">
              Ringkasan perangkat ajar yang sudah Anda siapkan.
              {menit > 0 && (
                <>
                  {' '}
                  Perkiraan waktu yang dihemat: <strong>{hemat}</strong>
                  <span className="sr-only"> ({angka(menit, 0)} menit, perkiraan kasar dengan asumsi ±45 menit per modul dan ±30 menit per set soal)</span>.
                </>
              )}
            </p>
          </div>
          {/* Ilustrasi hanya untuk layar sm ke atas; di HP banner cukup teks. */}
          <img
            src="/banner-guru.png"
            alt=""
            width={500}
            height={274}
            className="pointer-events-none absolute bottom-0 right-0 hidden h-[92%] w-auto max-w-[52%] object-contain object-right-bottom sm:block"
          />
        </section>

        <div className="grid grid-cols-3 gap-3">
          {[
            ['Ruang Kelas', d.kelas.length, '/kelas'],
            ['Modul Ajar', d.modul.length, '/modul'],
            ['Bank Soal', d.soal.length, '/soal'],
          ].map(([label, nilai, ke]) => (
            <Link key={label as string} to={ke as string} className="kartu flex flex-col justify-between gap-3 p-4 transition-colors hover:border-ajarin-500">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ajarin-50 text-ajarin-500">
                <Ikon nama="modul" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ajarin-600">{label}</span>
                <span className="block text-3xl font-bold text-ajarin-500">{nilai}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <Panduan
        demo={demo}
        langkah={
          demo
            ? [
                { ke: '/modul', judul: 'Lihat modul ajar contoh', isi: 'Draf Kurikulum Merdeka lengkap dengan rumus. Coba sunting, cetak, atau unduh Word.', selesai: false },
                { ke: '/soal', judul: 'Bank soal & soal remedial', isi: 'Buka kuis contoh, lalu lihat set remedial yang dibuat khusus untuk siswa di bawah KKM.', selesai: false },
                { ke: '/kelas', judul: 'Rekap nilai kelas 7A', isi: 'Nilai, status tuntas / remedial, dan rapor tiap siswa.', selesai: false },
                { ke: '/dampak', judul: 'Dampak & peta belajar', isi: 'Materi yang belum dikuasai, tren kelas, dan perubahan nilai setelah remedial.', selesai: false },
              ]
            : [
                { ke: '/modul/baru', judul: 'Buat modul ajar', isi: 'Isi topik dan tujuan, AI menyusun drafnya.', selesai: d.modul.length > 0 },
                { ke: '/soal/baru', judul: 'Buat set soal', isi: 'Soal pilihan ganda dengan kunci dan pembahasan.', selesai: d.soal.length > 0 },
                { ke: '/kelas', judul: 'Tambah kelas dan siswa', isi: 'Impor daftar siswa dari Excel atau tempel dari spreadsheet.', selesai: siswa > 0 },
                { ke: '/dampak', judul: 'Catat nilai, lihat dampaknya', isi: 'Peta materi dan siswa yang perlu perhatian muncul otomatis.', selesai: d.bernilai > 0 },
              ]
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="kartu">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold sm:text-xl">Kelas yang anda buat</h2>
            <Link to="/kelas" className="tautan-teks shrink-0">
              Lihat Semua Kelas
            </Link>
          </div>
          {d.kelas.length === 0 ? (
            <p className="py-6 text-center text-sm text-tinta-500">Belum ada kelas. Tambahkan kelas pertama Anda di menu Kelas & Nilai.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.kelas.slice(0, 3).map((k) => (
                <li key={k.id} className="flex flex-col">
                  <Sampul varian="kelas" className="!aspect-auto h-[140px] sm:h-[159px]" />
                  <p className="mt-3 text-lg font-bold">Kelas {k.nama}</p>
                  <p className="text-xs text-tinta-300">
                    {k.tapel} <span className="mx-1 text-tinta-100">|</span> {k.jumlahSiswa} Siswa
                  </p>
                  <Link to={`/kelas/${k.id}`} className="btn-garis mt-3 w-full py-2 text-xs">
                    Detail Kelas <Ikon nama="panah" className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="kartu flex flex-col">
          <h2 className="mb-3 text-lg font-bold sm:text-xl">Bank Soal Terbaru</h2>
          {d.soal.length === 0 ? (
            <p className="py-6 text-center text-sm text-tinta-500">Belum ada set soal.</p>
          ) : (
            <ul className="space-y-1">
              {d.soal.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <Link to={`/soal/${s.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-ajarin-50">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ajarin-50 text-ajarin-500">
                      <Ikon nama="soal" className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.judul}</span>
                      <span className="block truncate text-sm text-tinta-300">
                        {s.mapel} · {s.jumlahSoal} Soal
                      </span>
                    </span>
                    <Ikon nama="kanan" className="h-5 w-5 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/soal" className="btn-garis mt-auto w-full pt-2.5">
            Lihat Semua Bank Soal
          </Link>
        </section>
      </div>

      <section className="kartu">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold sm:text-xl">Modul Ajar</h2>
          <Link to="/modul" className="tautan-teks shrink-0">
            Lihat Semua Modul Ajar
          </Link>
        </div>
        {d.modul.length === 0 ? (
          <p className="py-6 text-center text-sm text-tinta-500">Belum ada modul ajar.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-[14px] border border-ajarin-50 md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[#E6E6E6] text-left text-ajarin-200">
                    <th className="px-4 py-3.5 font-bold">Nama Modul</th>
                    <th className="px-4 py-3.5 font-bold">Topik</th>
                    <th className="px-4 py-3.5 text-center font-bold">Kelas</th>
                    <th className="px-4 py-3.5 text-center font-bold">Durasi Modul</th>
                    <th className="px-4 py-3.5 text-right font-bold">Tanggal Dibuat</th>
                  </tr>
                </thead>
                <tbody className="font-medium">
                  {d.modul.slice(0, 4).map((m) => (
                    <tr key={m.id} className="border-b border-[#E6E6E6] last:border-0 hover:bg-ajarin-50/50">
                      <td className="px-4 py-3.5">
                        <Link to={`/modul/${m.id}`} className="hover:text-ajarin-500 hover:underline">
                          {m.judul}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">{m.topik}</td>
                      <td className="px-4 py-3.5 text-center">{m.kelas}</td>
                      <td className="px-4 py-3.5 text-center">{m.alokasiWaktu ?? '–'}</td>
                      <td className="px-4 py-3.5 text-right">{tanggalPanjang(m.createdAt ?? m.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 md:hidden">
              {d.modul.slice(0, 4).map((m) => (
                <li key={m.id}>
                  <Link to={`/modul/${m.id}`} className="block rounded-xl border border-tinta-100 p-3 hover:border-ajarin-500">
                    <span className="block font-semibold">{m.judul}</span>
                    <span className="block text-xs text-tinta-500">
                      {m.topik} · {m.jenjang} kelas {m.kelas} · {tanggalPanjang(m.createdAt ?? m.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
