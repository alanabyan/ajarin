import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header, Ikon, Kosong, Memuat, Pesan, Sampul, useCari } from '../components/ui';
import api, { pesanError } from '../lib/api';
import type { ModulRingkas } from '../types';

export default function ModulList() {
  const [daftar, setDaftar] = useState<ModulRingkas[] | null>(null);
  const [galat, setGalat] = useState('');
  const cari = useCari();

  const muat = () =>
    api
      .get('/modul')
      .then((r) => setDaftar(r.data.modul))
      .catch((e) => {
        setGalat(pesanError(e));
        setDaftar([]);
      });

  useEffect(() => {
    void muat();
  }, []);

  async function hapus(m: ModulRingkas) {
    if (!window.confirm(`Hapus modul "${m.judul}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setGalat('');
    try {
      await api.delete(`/modul/${m.id}`);
      await muat();
    } catch (e) {
      setGalat(pesanError(e, 'Gagal menghapus modul.'));
    }
  }

  if (!daftar) return <Memuat />;
  const tampil = daftar.filter((m) => `${m.judul} ${m.topik}`.toLowerCase().includes(cari));

  return (
    <div>
      <Header
        judul="Daftar Semua Modul"
        aksi={
          <Link to="/modul/baru" className="btn-utama px-7 py-3.5 text-base">
            Buat Modul <Ikon nama="plus" className="h-4 w-4" />
          </Link>
        }
      />
      {galat && (
        <div className="mb-4">
          <Pesan nada="galat">{galat}</Pesan>
        </div>
      )}

      {daftar.length === 0 ? (
        <Kosong
          judul="Belum ada modul ajar"
          isi="Isi topik dan tujuan pembelajaran, lalu AJARIN menyusun drafnya untuk Anda."
          aksi={
            <Link to="/modul/baru" className="btn-utama">
              Buat modul pertama
            </Link>
          }
        />
      ) : tampil.length === 0 ? (
        <p className="text-sm text-tinta-500">Tidak ada modul yang cocok dengan pencarian.</p>
      ) : (
        <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {tampil.map((m) => (
            <li key={m.id} className="flex flex-col gap-2.5">
              <Link to={`/modul/${m.id}`} aria-label={`Buka ${m.judul}`}>
                <Sampul varian="modul" />
              </Link>
              <div className="flex flex-1 flex-col gap-5 px-1.5">
                <div className="space-y-1.5">
                  <h2 className="line-clamp-2 text-xl font-bold leading-snug">
                    <Link to={`/modul/${m.id}`} className="hover:text-ajarin-500">
                      {m.judul}
                    </Link>
                  </h2>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-[#CCCCCC]">
                    <span>{m.topik}</span>
                    <span aria-hidden="true" className="h-3 w-px bg-[#E6E6E6]" />
                    <span>
                      {m.jenjang} kelas {m.kelas}
                    </span>
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs font-bold">
                  <Link to={`/modul/${m.id}`} className="text-ajarin-500 hover:underline">
                    Edit Modul
                  </Link>
                  <button type="button" onClick={() => hapus(m)} className="text-merah hover:underline">
                    Hapus Modul
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
