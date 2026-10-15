import { FormEvent, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Header, Kolom, PeringatanAI, Pesan, TombolKembali, propsKontrol } from '../components/ui';
import { PilihMapel } from '../components/PilihCari';
import api, { kodeError, kolomError, pesanError } from '../lib/api';
import { JENJANG, KELAS_PER_JENJANG, MAPEL_PER_JENJANG, fase } from '../lib/akademik';
import { useAuth } from '../lib/auth';
import { useJaringan } from '../lib/offline/jaringan';
import type { DariModul, Jenjang } from '../types';

const JUMLAH = [5, 10, 15, 20];

const LABEL: Record<string, string> = {
  judul: 'Judul set soal',
  mapel: 'Mata pelajaran',
  jenjang: 'Jenjang',
  kelas: 'Kelas',
  jumlah: 'Jumlah soal',
  materi: 'Materi',
  tingkat: 'Tingkat kesulitan',
};

interface Isian {
  judul: string;
  mapel: string;
  jenjang: Jenjang;
  kelas: string;
  materi: string;
  tingkat: string;
  jumlah: number;
}

function validasi(f: Isian): Record<string, string> {
  const g: Record<string, string> = {};
  if (f.judul.trim().length < 5) g.judul = 'Judul minimal 5 karakter.';
  if (f.mapel.trim().length < 2) g.mapel = 'Pilih atau tulis mata pelajaran.';
  if (!KELAS_PER_JENJANG[f.jenjang].includes(f.kelas)) g.kelas = 'Pilih kelas.';
  if (f.materi.trim().length < 3) g.materi = 'Tulis materi minimal 3 karakter.';
  return g;
}

export default function SoalBaru() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Dibuka dari halaman modul ("Buat soal dari modul ini"): identitas terisi dan materi modul bisa dipilih.
  const dariModul = (useLocation().state as { dariModul?: DariModul } | null)?.dariModul;
  const awal = (m?: DariModul): Isian => ({
    judul: '',
    mapel: m?.mapel || user?.mapel || '',
    jenjang: m?.jenjang ?? user?.jenjang ?? 'SMP',
    kelas: m?.kelas ?? '',
    materi: '',
    tingkat: 'sedang',
    jumlah: 10,
  });
  const [f, setF] = useState<Isian>(() => awal(dariModul));
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [peringatan, setPeringatan] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const { online } = useJaringan();
  const [galat, setGalat] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const atur = <K extends keyof Isian>(k: K, v: Isian[K]) => {
    setF((lama) => ({ ...lama, [k]: v }));
    if (kolom[k]) setKolom(({ [k]: _, ...sisa }) => sisa);
    setPeringatan(false);
  };

  function ubahJenjang(jenjang: Jenjang) {
    const mapelDaftar = JENJANG.some((j) => MAPEL_PER_JENJANG[j].includes(f.mapel));
    setF((lama) => ({
      ...lama,
      jenjang,
      kelas: KELAS_PER_JENJANG[jenjang].includes(lama.kelas) ? lama.kelas : '',
      mapel: mapelDaftar && !MAPEL_PER_JENJANG[jenjang].includes(lama.mapel) ? '' : lama.mapel,
    }));
    setPeringatan(false);
  }

  function fokus(g: Record<string, string>) {
    const pertama = Object.keys(LABEL).find((k) => g[k]);
    if (pertama) formRef.current?.querySelector<HTMLElement>(`#${pertama}`)?.focus();
  }

  async function buat(abaikanPeringatan: boolean) {
    setGalat('');
    const g = validasi(f);
    setKolom(g);
    if (Object.keys(g).length) return fokus(g);
    setSibuk(true);
    setPeringatan(false);
    try {
      const res = await api.post('/soal/buat', { ...f, abaikanPeringatan: abaikanPeringatan || undefined });
      navigate(`/soal/${res.data.set.id}`);
    } catch (err) {
      const k = kolomError(err);
      setKolom(k);
      if (kodeError(err) === 'PERINGATAN_AI') setPeringatan(true);
      else setGalat(pesanError(err, 'Gagal membuat soal.'));
      fokus(k);
      setSibuk(false);
    }
  }

  function kirim(e: FormEvent) {
    e.preventDefault();
    void buat(false);
  }

  const faseKelas = fase(f.kelas);

  // Bekal modul tersimpan di riwayat browser (ikut terbawa saat muat ulang / Back), jadi bisa dilepas di sini.
  function lepasModul() {
    navigate('/soal/baru', { replace: true, state: null });
    setF(awal());
    setKolom({});
    setPeringatan(false);
    setGalat('');
  }

  // Ganti materi: judul selalu disusun ulang dari materi baru; ketikan tambahan pada judul sebelumnya dibuang.
  function pilihMateri(m: string) {
    atur('materi', m);
    atur('judul', `Kuis ${m}`.slice(0, 150));
  }

  return (
    <div className="max-w-2xl">
      {/* Dibuka dari modul: kembali ke modul itu; selain itu ke daftar Bank Soal. */}
      {dariModul ? (
        <TombolKembali ke={`/modul/${dariModul.id}`} label="Kembali ke modul" />
      ) : (
        <TombolKembali ke="/soal" label="Kembali ke Bank Soal" />
      )}
      <Header judul="Buat Set Soal" deskripsi="Periksa dan koreksi soal sebelum dibagikan kepada siswa." />
      <form ref={formRef} onSubmit={kirim} noValidate className="kartu space-y-4">
        {dariModul && (
          <div className="rounded-xl border border-ajarin-100 bg-ajarin-50 p-4 text-sm">
            <p>
              Diisi dari modul{' '}
              <Link to={`/modul/${dariModul.id}`} className="font-bold text-ajarin-600 underline">
                {dariModul.judul}
              </Link>
              . {dariModul.materi.length > 0 ? 'Pilih materi yang akan diujikan:' : 'Tulis materi yang akan diujikan di bawah.'}{' '}
              <button type="button" onClick={lepasModul} className="font-semibold text-tinta-500 underline hover:text-tinta-900">
                Isi manual tanpa modul
              </button>
            </p>
            {dariModul.materi.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Materi dari modul">
                {dariModul.materi.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={f.materi === m}
                    onClick={() => pilihMateri(m)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      f.materi === m ? 'border-ajarin-500 bg-ajarin-500 text-white' : 'border-ajarin-200 bg-white text-ajarin-600 hover:bg-ajarin-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Kolom id="judul" label="Judul set soal" galat={kolom.judul}>
          <input {...propsKontrol('judul', kolom.judul)} maxLength={150} placeholder="Contoh: Kuis Persamaan Linear" value={f.judul} onChange={(e) => atur('judul', e.target.value)} />
        </Kolom>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Kolom id="jenjang" label="Jenjang">
            <select {...propsKontrol('jenjang')} value={f.jenjang} onChange={(e) => ubahJenjang(e.target.value as Jenjang)}>
              {JENJANG.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
          </Kolom>
          <Kolom id="kelas" label="Kelas" galat={kolom.kelas} petunjuk={faseKelas && `Fase ${faseKelas}`}>
            <select
              {...propsKontrol('kelas', kolom.kelas, !!faseKelas)}
              value={f.kelas}
              onChange={(e) => atur('kelas', e.target.value)}
              className={`${propsKontrol('kelas', kolom.kelas).className} ${f.kelas ? '' : 'text-[#999]'}`}
            >
              <option value="" disabled>
                Pilih kelas
              </option>
              {KELAS_PER_JENJANG[f.jenjang].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Kolom>
        </div>
        <Kolom id="mapel" label="Mata pelajaran" galat={kolom.mapel}>
          <PilihMapel key={f.jenjang} id="mapel" jenjang={f.jenjang} value={f.mapel} onChange={(v) => atur('mapel', v)} galat={kolom.mapel} />
        </Kolom>
        <Kolom id="materi" label="Materi" galat={kolom.materi}>
          <input
            {...propsKontrol('materi', kolom.materi)}
            maxLength={300}
            placeholder="Contoh: Persamaan linear satu variabel"
            value={f.materi}
            onChange={(e) => atur('materi', e.target.value)}
          />
        </Kolom>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Kolom id="jumlah" label="Jumlah soal">
            <select {...propsKontrol('jumlah')} value={f.jumlah} onChange={(e) => atur('jumlah', Number(e.target.value))}>
              {JUMLAH.map((n) => (
                <option key={n} value={n}>
                  {n} soal
                </option>
              ))}
            </select>
          </Kolom>
          <Kolom id="tingkat" label="Tingkat kesulitan">
            <select {...propsKontrol('tingkat')} value={f.tingkat} onChange={(e) => atur('tingkat', e.target.value)}>
              <option value="mudah">Mudah</option>
              <option value="sedang">Sedang</option>
              <option value="sulit">Sulit</option>
            </select>
          </Kolom>
        </div>
        {peringatan && <PeringatanAI kolom={kolom} label={LABEL} sibuk={sibuk} onLanjut={() => void buat(true)} teksLanjut="Isian sudah benar, tetap buat soal" />}
        {galat && <Pesan nada="galat">{galat}</Pesan>}
        <button type="submit" disabled={sibuk || !online} className="btn-utama w-full sm:w-auto">
          {sibuk ? 'Memeriksa dan menyusun soal (bisa sampai 30 detik)...' : 'Buat soal'}
        </button>
        {!online && <Pesan nada="awas">Anda sedang offline. Membuat soal dengan AI butuh internet.</Pesan>}
      </form>
    </div>
  );
}
