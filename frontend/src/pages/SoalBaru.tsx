import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Pesan } from '../components/ui';
import api, { pesanError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useJaringan } from '../lib/offline/jaringan';
import type { Jenjang } from '../types';

export default function SoalBaru() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({
    judul: '',
    mapel: user?.mapel ?? '',
    jenjang: (user?.jenjang ?? 'SMP') as Jenjang,
    kelas: '',
    materi: '',
    tingkat: 'sedang',
    jumlah: 10,
  });
  const [sibuk, setSibuk] = useState(false);
  const { online } = useJaringan();
  const [galat, setGalat] = useState('');

  const ubah = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: k === 'jumlah' ? Number(e.target.value) : e.target.value });

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat('');
    setSibuk(true);
    try {
      const res = await api.post('/soal/buat', f);
      navigate(`/soal/${res.data.set.id}`);
    } catch (err) {
      setGalat(pesanError(err, 'Gagal membuat soal.'));
      setSibuk(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Header judul="Buat Set Soal" deskripsi="Periksa dan koreksi soal sebelum dibagikan kepada siswa." />
      <form onSubmit={kirim} className="kartu space-y-4">
        <div>
          <label htmlFor="judul" className="label">
            Judul set soal
          </label>
          <input id="judul" required minLength={2} className="input" value={f.judul} onChange={ubah('judul')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mapel" className="label">
              Mata pelajaran
            </label>
            <input id="mapel" required className="input" value={f.mapel} onChange={ubah('mapel')} />
          </div>
          <div>
            <label htmlFor="jenjang" className="label">
              Jenjang
            </label>
            <select id="jenjang" className="input" value={f.jenjang} onChange={ubah('jenjang')}>
              {['SD', 'SMP', 'SMA', 'SMK'].map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kelas" className="label">
              Kelas
            </label>
            <input id="kelas" required placeholder="mis. VII" className="input" value={f.kelas} onChange={ubah('kelas')} />
          </div>
          <div>
            <label htmlFor="jumlah" className="label">
              Jumlah soal (1–20)
            </label>
            <input id="jumlah" type="number" min={1} max={20} required className="input" value={f.jumlah} onChange={ubah('jumlah')} />
          </div>
        </div>
        <div>
          <label htmlFor="materi" className="label">
            Materi
          </label>
          <input id="materi" required minLength={2} placeholder="mis. Persamaan linear satu variabel" className="input" value={f.materi} onChange={ubah('materi')} />
        </div>
        <div>
          <label htmlFor="tingkat" className="label">
            Tingkat kesulitan
          </label>
          <select id="tingkat" className="input" value={f.tingkat} onChange={ubah('tingkat')}>
            <option value="mudah">Mudah</option>
            <option value="sedang">Sedang</option>
            <option value="sulit">Sulit</option>
          </select>
        </div>
        {galat && <Pesan nada="galat">{galat}</Pesan>}
        <button type="submit" disabled={sibuk || !online} className="btn-utama w-full sm:w-auto">
          {sibuk ? 'Menyusun soal (bisa sampai 30 detik)...' : 'Buat soal'}
        </button>
        {!online && <Pesan nada="awas">Anda sedang offline. Membuat soal dengan AI butuh internet.</Pesan>}
      </form>
    </div>
  );
}
