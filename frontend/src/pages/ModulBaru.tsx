import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Markdown from '../components/Markdown';
import { Pesan } from '../components/ui';
import { pesanError, postAlir } from '../lib/api';
import { useJaringan } from '../lib/offline/jaringan';
import { useAuth } from '../lib/auth';
import type { Jenjang } from '../types';

// Kelas yang dipilih mengikuti jenjang (penulisan angka Romawi seperti di modul ajar).
const KELAS_PER_JENJANG: Record<Jenjang, string[]> = {
  SD: ['I', 'II', 'III', 'IV', 'V', 'VI'],
  SMP: ['VII', 'VIII', 'IX'],
  SMA: ['X', 'XI', 'XII'],
  SMK: ['X', 'XI', 'XII'],
};

export default function ModulBaru() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({
    judul: '',
    topik: '',
    mapel: user?.mapel ?? '',
    jenjang: (user?.jenjang ?? 'SMP') as Jenjang,
    kelas: '',
    alokasiWaktu: '',
    tujuanPembelajaran: '',
    kondisiKelas: '',
  });
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [teks, setTeks] = useState('');
  const batal = useRef<AbortController | null>(null);
  const { online } = useJaringan();

  // Menghentikan penulisan bila halaman ditinggalkan; server ikut menghentikan AI dan tidak menyimpan apa pun.
  useEffect(() => () => batal.current?.abort(), []);

  const ubah = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  // Ganti jenjang: kelas yang tidak ada di jenjang baru dikosongkan.
  const ubahJenjang = (e: { target: { value: string } }) => {
    const jenjang = e.target.value as Jenjang;
    setF({ ...f, jenjang, kelas: KELAS_PER_JENJANG[jenjang].includes(f.kelas) ? f.kelas : '' });
  };

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat('');
    setTeks('');
    setSibuk(true);
    const ctrl = new AbortController();
    batal.current = ctrl;

    // Teks tiba puluhan kali per detik; render Markdown + rumus tiap potongan terlalu berat, jadi diperbarui berkala.
    let buffer = '';
    const segarkan = window.setInterval(() => setTeks(buffer), 250);
    let selesaiId = '';
    try {
      await postAlir<{ t?: string; id?: string; error?: string }>(
        '/modul/buat-stream',
        { ...f, kondisiKelas: f.kondisiKelas || undefined },
        (b) => {
          if (b.error) throw new Error(b.error);
          if (b.t) buffer += b.t;
          if (b.id) selesaiId = b.id;
        },
        ctrl.signal
      );
      if (!selesaiId) throw new Error('Penulisan modul terhenti sebelum selesai. Coba lagi.');
      navigate(`/modul/${selesaiId}`);
    } catch (err) {
      if (ctrl.signal.aborted) {
        setGalat('Penyusunan modul dibatalkan.');
      } else {
        setGalat(pesanError(err, 'Gagal membuat modul.'));
      }
      setSibuk(false);
    } finally {
      window.clearInterval(segarkan);
      setTeks(buffer);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Buat Modul Ajar</h1>
        <p className="mt-1.5 text-base font-medium text-[#CCCCCC]">Isi detail singkat, sistem akan menyusun draft yang bisa kamu edit.</p>
      </div>
      <form onSubmit={kirim} className="kartu space-y-5 border-[#E6E6E6] p-4 sm:p-5">
        <div>
          <label htmlFor="judul" className="label">
            Judul Modul
          </label>
          <input id="judul" required minLength={2} placeholder="Tulis Judul Modul" className="input" value={f.judul} onChange={ubah('judul')} />
        </div>
        <div>
          <label htmlFor="topik" className="label">
            Topik
          </label>
          <input id="topik" required minLength={2} placeholder="Tulis Topik" className="input" value={f.topik} onChange={ubah('topik')} />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="jenjang" className="label">
              Jenjang
            </label>
            <select id="jenjang" className="input" value={f.jenjang} onChange={ubahJenjang}>
              {(Object.keys(KELAS_PER_JENJANG) as Jenjang[]).map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kelas" className="label">
              Kelas
            </label>
            <select id="kelas" required className={`input ${f.kelas ? '' : 'text-[#CCCCCC]'}`} value={f.kelas} onChange={ubah('kelas')}>
              <option value="" disabled>
                Pilih Kelas
              </option>
              {KELAS_PER_JENJANG[f.jenjang].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="tujuan" className="label">
            Tujuan Pembelajaran
          </label>
          <textarea
            id="tujuan"
            required
            minLength={5}
            rows={5}
            placeholder="Tulis Tujuan Pembelajaran"
            className="input min-h-[140px]"
            value={f.tujuanPembelajaran}
            onChange={ubah('tujuanPembelajaran')}
          />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="waktu" className="label">
              Alokasi Waktu
            </label>
            <input id="waktu" required placeholder="Contoh: 2×40 Menit" className="input" value={f.alokasiWaktu} onChange={ubah('alokasiWaktu')} />
          </div>
          <div>
            <label htmlFor="kondisi" className="label">
              Kondisi Kelas (Opsional)
            </label>
            <input id="kondisi" placeholder="Contoh: Tanpa Proyektor" className="input" value={f.kondisiKelas} onChange={ubah('kondisiKelas')} />
          </div>
        </div>
        {galat && <Pesan nada="galat">{galat}</Pesan>}
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <button type="submit" disabled={sibuk || !online} className="btn-utama w-full py-3.5 text-xl sm:flex-1">
            {sibuk ? 'Menyusun modul...' : 'Buat Modul'}
          </button>
          {sibuk && (
            <button type="button" onClick={() => batal.current?.abort()} className="btn-garis w-full sm:w-auto">
              Batalkan
            </button>
          )}
        </div>
        {!online && <Pesan nada="awas">Anda sedang offline. Membuat modul dengan AI butuh internet.</Pesan>}
      </form>

      {teks && (
        <div className="kartu mt-6" aria-live="off">
          <p className="mb-3 text-sm text-tinta-500">
            {sibuk ? 'Modul sedang ditulis. Anda akan dibawa ke halaman modul setelah selesai dan tersimpan.' : 'Draf terakhir (tidak tersimpan).'}
          </p>
          <Markdown>{teks}</Markdown>
        </div>
      )}
    </div>
  );
}
