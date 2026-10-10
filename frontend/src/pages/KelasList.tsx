import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header, Ikon, Kosong, Memuat, Pesan, Sampul, SelectPil, useCari } from '../components/ui';
import api, { pesanError } from '../lib/api';
import type { KelasRingkas, Siswa } from '../types';

function tahunPelajaran(): string {
  const d = new Date();
  const mulai = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${mulai}/${mulai + 1}`;
}

export default function KelasList() {
  const [daftar, setDaftar] = useState<KelasRingkas[] | null>(null);
  const [bukaForm, setBukaForm] = useState(false);
  const [nama, setNama] = useState('');
  const [tapel, setTapel] = useState(tahunPelajaran());
  const [kkm, setKkm] = useState(75);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const cari = useCari();

  // Daftar siswa di bagian bawah: dimuat per kelas yang dipilih.
  const [kelasId, setKelasId] = useState('');
  const [siswa, setSiswa] = useState<Siswa[]>([]);
  const [cariSiswa, setCariSiswa] = useState('');

  const muat = () =>
    api
      .get('/kelas')
      .then((r) => setDaftar(r.data.kelas))
      .catch((e) => {
        setGalat(pesanError(e));
        setDaftar([]);
      });

  const muatSiswa = (id: string) =>
    id
      ? api
          .get(`/kelas/${id}`)
          .then((r) => setSiswa(r.data.siswa))
          .catch((e) => setGalat(pesanError(e)))
      : Promise.resolve(setSiswa([]));

  useEffect(() => {
    void muat();
  }, []);

  useEffect(() => {
    void muatSiswa(kelasId);
  }, [kelasId]);

  // Pilihan awal: kelas pertama, supaya tabel siswa langsung terisi.
  useEffect(() => {
    if (daftar && daftar.length > 0 && !daftar.some((k) => k.id === kelasId)) setKelasId(daftar[0].id);
  }, [daftar]); // eslint-disable-line react-hooks/exhaustive-deps

  async function tambah(e: FormEvent) {
    e.preventDefault();
    setGalat('');
    setSibuk(true);
    try {
      await api.post('/kelas', { nama, tapel, kkm });
      setNama('');
      setBukaForm(false);
      await muat();
    } catch (err) {
      setGalat(pesanError(err, 'Gagal membuat kelas.'));
    } finally {
      setSibuk(false);
    }
  }

  async function hapusKelas(k: KelasRingkas) {
    if (!window.confirm(`Hapus kelas ${k.nama} beserta seluruh siswa dan nilainya? Tindakan ini tidak bisa dibatalkan.`)) return;
    setGalat('');
    try {
      await api.delete(`/kelas/${k.id}`);
      await muat();
    } catch (e) {
      setGalat(pesanError(e));
    }
  }

  async function hapusSiswa(s: Siswa) {
    if (!window.confirm(`Hapus ${s.nama} beserta seluruh nilainya?`)) return;
    setGalat('');
    try {
      await api.delete(`/kelas/siswa/${s.id}`);
      await Promise.all([muatSiswa(kelasId), muat()]);
    } catch (e) {
      setGalat(pesanError(e));
    }
  }

  if (!daftar) return <Memuat />;

  const tampil = daftar.filter((k) => `${k.nama} ${k.tapel}`.toLowerCase().includes(cari));
  const kelasTerpilih = daftar.find((k) => k.id === kelasId);
  const q = cariSiswa.trim().toLowerCase();
  const siswaTampil = siswa.filter((s) => `${s.nama} ${s.nis}`.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <div>
        <Header
          judul="Daftar Semua Kelas"
          aksi={
            <button type="button" onClick={() => setBukaForm((v) => !v)} aria-expanded={bukaForm} className="btn-utama px-7 py-3.5 text-base">
              Buat Kelas <Ikon nama="plus" className="h-4 w-4" />
            </button>
          }
        />

        {bukaForm && (
          <form onSubmit={tambah} className="kartu mb-5 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="nama" className="label">
                Nama kelas
              </label>
              <input id="nama" required placeholder="mis. 8B" className="input" value={nama} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div>
              <label htmlFor="tapel" className="label">
                Tahun pelajaran
              </label>
              <input id="tapel" required className="input" value={tapel} onChange={(e) => setTapel(e.target.value)} />
            </div>
            <div>
              <label htmlFor="kkm" className="label">
                KKM
              </label>
              <input id="kkm" type="number" min={0} max={100} required className="input" value={kkm} onChange={(e) => setKkm(Number(e.target.value))} />
            </div>
            <button type="submit" disabled={sibuk} className="btn-utama py-3">
              {sibuk ? 'Menyimpan...' : 'Tambah kelas'}
            </button>
          </form>
        )}
        {galat && (
          <div className="mb-4">
            <Pesan nada="galat">{galat}</Pesan>
          </div>
        )}

        {daftar.length === 0 ? (
          <Kosong judul="Belum ada kelas" isi="Tambahkan kelas lewat tombol Buat Kelas, lalu isi daftar siswanya." />
        ) : tampil.length === 0 ? (
          <p className="text-sm text-tinta-500">Tidak ada kelas yang cocok dengan pencarian.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {tampil.map((k) => (
              <li key={k.id} className="flex flex-col gap-2.5 rounded-[20px] bg-white p-3 shadow-kartu">
                <Sampul varian="kelas" lencana={k.tapel} className="!aspect-auto h-[130px] !rounded-xl" />
                <div className="flex items-center justify-between gap-2.5 px-1">
                  <h2 className="min-w-0 flex-1 truncate text-base font-bold text-[#202020]">Kelas {k.nama}</h2>
                  <span className="shrink-0 text-[10px] font-semibold text-ajarin-200">{k.jumlahSiswa} siswa</span>
                </div>
                <div className="flex gap-[7px]">
                  <Link to={`/kelas/${k.id}`} className="flex flex-1 items-center justify-center rounded-[7px] bg-ajarin-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-ajarin-600">
                    Detail Kelas
                  </Link>
                  <button
                    type="button"
                    onClick={() => hapusKelas(k)}
                    aria-label={`Hapus kelas ${k.nama}`}
                    className="flex w-[35px] shrink-0 items-center justify-center rounded-[7px] border border-merah text-merah hover:bg-red-50"
                  >
                    <Ikon nama="hapus" className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {daftar.length > 0 && (
        <section className="kartu shadow-kartu sm:p-5" aria-labelledby="judul-siswa">
          <div className="mb-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 id="judul-siswa" className="text-xl font-bold">
              Daftar Siswa
            </h2>
            <div className="flex flex-col gap-[7px] sm:flex-row lg:w-[34rem]">
              <SelectPil aria-label="Pilih kelas" className="sm:w-48" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
                {daftar.map((k) => (
                  <option key={k.id} value={k.id}>
                    Kelas {k.nama}
                  </option>
                ))}
              </SelectPil>
              <div className="relative flex-1">
                <Ikon nama="cari" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-300" />
                <input
                  type="search"
                  aria-label="Cari siswa"
                  placeholder="Search..."
                  className="input-pil pl-11"
                  value={cariSiswa}
                  onChange={(e) => setCariSiswa(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-[7px] border border-[#E6E6E6]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[#E6E6E6] text-left font-semibold text-ajarin-700">
                  <th className="w-16 px-4 py-3.5">No</th>
                  <th className="px-4 py-3.5">Nama Siswa</th>
                  <th className="px-4 py-3.5 text-center">Kelas</th>
                  <th className="px-4 py-3.5 text-center">NIS</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="font-medium text-tinta-400">
                {siswaTampil.map((s, i) => (
                  <tr key={s.id} className="border-b border-[#E6E6E6] last:border-0">
                    <td className="px-4 py-3">{i + 1}</td>
                    <td className="px-4 py-3">{s.nama}</td>
                    <td className="px-4 py-3 text-center">{kelasTerpilih?.nama}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{s.nis}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => hapusSiswa(s)} className="font-semibold text-merah hover:underline">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
                {siswaTampil.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-tinta-500">
                      {siswa.length === 0 ? 'Belum ada siswa di kelas ini. Tambahkan lewat Detail Kelas.' : 'Tidak ada siswa yang cocok.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
