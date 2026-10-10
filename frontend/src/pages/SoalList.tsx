import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header, Ikon, Kosong, Memuat, Pesan, Sampul, tapelDari, useCari } from '../components/ui';
import api, { pesanError } from '../lib/api';
import type { SetSoalRingkas } from '../types';

export default function SoalList() {
  const [daftar, setDaftar] = useState<SetSoalRingkas[] | null>(null);
  const [galat, setGalat] = useState('');
  const cari = useCari();

  const muat = () =>
    api
      .get('/soal')
      .then((r) => setDaftar(r.data.set))
      .catch((e) => {
        setGalat(pesanError(e));
        setDaftar([]);
      });

  useEffect(() => {
    void muat();
  }, []);

  async function hapus(s: SetSoalRingkas) {
    if (!window.confirm(`Hapus set soal "${s.judul}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setGalat('');
    try {
      await api.delete(`/soal/${s.id}`);
      await muat();
    } catch (e) {
      setGalat(pesanError(e, 'Gagal menghapus set soal.'));
    }
  }

  if (!daftar) return <Memuat />;
  const tampil = daftar.filter((s) => `${s.judul} ${s.mapel}`.toLowerCase().includes(cari));

  return (
    <div>
      <Header
        judul="Bank Soal"
        aksi={
          <Link to="/soal/baru" className="btn-utama px-7 py-3.5 text-base">
            Buat Set Soal <Ikon nama="plus" className="h-4 w-4" />
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
          judul="Belum ada set soal"
          isi="Tentukan materi dan tingkat kesulitan, lalu soal beserta pembahasannya dibuatkan."
          aksi={
            <Link to="/soal/baru" className="btn-utama">
              Buat set soal pertama
            </Link>
          }
        />
      ) : tampil.length === 0 ? (
        <p className="text-sm text-tinta-500">Tidak ada set soal yang cocok dengan pencarian.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {tampil.map((s) => (
            <li key={s.id} className="flex flex-col gap-2.5 rounded-[20px] bg-white px-3 pb-5 pt-3 shadow-kartu">
              <Link to={`/soal/${s.id}`} aria-label={`Buka ${s.judul}`}>
                <Sampul varian="soal" lencana={tapelDari(s.createdAt)} className="!aspect-auto h-[130px] !rounded-xl" />
              </Link>
              <div className="flex flex-1 flex-col gap-5 px-1.5">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-2 text-xl font-bold leading-snug">
                      <Link to={`/soal/${s.id}`} className="hover:text-ajarin-500">
                        {s.judul}
                      </Link>
                    </h2>
                    {s.adaForm && <span className="lencana shrink-0 bg-ajarin-50 text-ajarin-500">Google Form</span>}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-[#CCCCCC]">
                    <span>{s.mapel}</span>
                    <span aria-hidden="true" className="h-3 w-px bg-[#E6E6E6]" />
                    <span>{s.jumlahSoal} Soal</span>
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs font-bold">
                  <Link to={`/soal/${s.id}`} className="text-ajarin-500 hover:underline">
                    Edit Soal
                  </Link>
                  <button type="button" onClick={() => hapus(s)} className="text-merah hover:underline">
                    Hapus Soal
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
