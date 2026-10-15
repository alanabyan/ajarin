import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Markdown from '../components/Markdown';
import { Header, Memuat, Pesan, TombolKembali } from '../components/ui';
import api, { pesanError, unduh } from '../lib/api';
import { useJaringan } from '../lib/offline/jaringan';
import { materiDariModul } from '../lib/akademik';
import { useAuth } from '../lib/auth';
import type { DariModul, Modul } from '../types';

export default function ModulDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modul, setModul] = useState<Modul | null>(null);
  const [ubah, setUbah] = useState(false);
  const [judul, setJudul] = useState('');
  const [konten, setKonten] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [mengunduh, setMengunduh] = useState(false);
  const { online } = useJaringan();
  const { user } = useAuth();

  useEffect(() => {
    api
      .get(`/modul/${id}`)
      .then((r) => {
        setModul(r.data.modul);
        setJudul(r.data.modul.judul);
        setKonten(r.data.modul.konten);
      })
      .catch((e) => setGalat(pesanError(e, 'Modul tidak ditemukan.')));
  }, [id]);

  if (!modul) {
    return galat ? (
      <div>
        <TombolKembali ke="/modul" label="Kembali ke Modul Ajar" />
        <Pesan nada="galat">{galat}</Pesan>
      </div>
    ) : (
      <Memuat />
    );
  }

  async function simpan() {
    setSibuk(true);
    setGalat('');
    try {
      const r = await api.put(`/modul/${id}`, { judul, konten });
      setModul(r.data.modul);
      setUbah(false);
      setInfo('Perubahan disimpan.');
    } catch (e) {
      setGalat(pesanError(e, 'Gagal menyimpan.'));
    } finally {
      setSibuk(false);
    }
  }

  async function hapus() {
    if (!window.confirm('Hapus modul ini? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      await api.delete(`/modul/${id}`);
      navigate('/modul');
    } catch (e) {
      setGalat(pesanError(e, 'Gagal menghapus.'));
    }
  }

  async function unduhWord() {
    setMengunduh(true);
    setGalat('');
    try {
      await unduh(`/modul/${id}/ekspor`, undefined, `${modul!.judul}.docx`);
    } catch (e) {
      setGalat(pesanError(e, 'Gagal mengunduh.'));
    } finally {
      setMengunduh(false);
    }
  }

  // Form Buat Soal diisi dari modul ini: mapel, jenjang, kelas, dan daftar materi dari tabel rencana pertemuan.
  function buatSoal() {
    const m = modul!;
    const dariModul: DariModul = {
      id: m.id,
      judul: m.judul,
      mapel: m.mapel ?? user?.mapel ?? '',
      jenjang: m.jenjang,
      kelas: m.kelas,
      materi: materiDariModul(m.konten, m.topik),
    };
    navigate('/soal/baru', { state: { dariModul } });
  }

  async function salin() {
    try {
      await navigator.clipboard.writeText(modul!.konten);
      setInfo('Teks modul disalin.');
    } catch {
      setGalat('Browser tidak mengizinkan menyalin. Pilih teks lalu salin manual.');
    }
  }

  return (
    <div>
      <TombolKembali ke="/modul" label="Kembali ke Modul Ajar" />
      <Header
        bertumpuk
        judul={modul.judul}
        deskripsi={
          modul.semester
            ? `${modul.jenjang} kelas ${modul.kelas} · Semester ${modul.semester} · ${modul.jumlahPertemuan} pertemuan · ${modul.alokasiWaktu}`
            : `${modul.topik} · ${modul.jenjang} kelas ${modul.kelas} · ${modul.alokasiWaktu}`
        }
        aksi={
          ubah ? (
            <>
              <button type="button" onClick={simpan} disabled={sibuk} className="btn-utama">
                {sibuk ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUbah(false);
                  setJudul(modul.judul);
                  setKonten(modul.konten);
                }}
                className="btn-garis"
              >
                Batal
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setUbah(true)} className="btn-utama">
                Sunting
              </button>
              <button type="button" onClick={buatSoal} className="btn-garis">
                Buat soal dari modul ini
              </button>
              <button type="button" onClick={() => window.print()} className="btn-garis">
                Cetak / PDF
              </button>
              <button type="button" onClick={unduhWord} disabled={mengunduh || !online} title={online ? undefined : 'Butuh internet'} className="btn-garis">
                {mengunduh ? 'Menyiapkan...' : 'Unduh Word'}
              </button>
              <button type="button" onClick={salin} className="btn-garis">
                Salin teks
              </button>
              <button type="button" onClick={hapus} disabled={!online} title={online ? undefined : 'Butuh internet'} className="btn-bahaya">
                Hapus
              </button>
            </>
          )
        }
      />
      <div className="space-y-3">
        {galat && <Pesan nada="galat">{galat}</Pesan>}
        {info && <Pesan nada="sukses">{info}</Pesan>}
      </div>

      {ubah ? (
        <div className="kartu mt-3 space-y-4">
          <div>
            <label htmlFor="judul" className="label">
              Judul
            </label>
            <input id="judul" className="input" value={judul} onChange={(e) => setJudul(e.target.value)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="konten" className="label">
                Isi modul (Markdown, rumus dengan $...$)
              </label>
              <textarea
                id="konten"
                rows={24}
                className="input font-mono text-xs"
                value={konten}
                onChange={(e) => setKonten(e.target.value)}
              />
            </div>
            <div>
              <p className="label">Pratinjau</p>
              <div className="max-h-[34rem] overflow-y-auto rounded-lg border border-tinta-100 p-4">
                <Markdown>{konten}</Markdown>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <article className="kartu mt-3 sm:p-8">
          <Markdown>{modul.konten}</Markdown>
        </article>
      )}
    </div>
  );
}
