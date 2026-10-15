import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Markdown from '../components/Markdown';
import { Kolom, PeringatanAI, Pesan, PilihMapel, propsKontrol } from '../components/ui';
import api, { kodeError, kolomError, pesanError, postAlir } from '../lib/api';
import { JENJANG, KELAS_PER_JENJANG, MAPEL_PER_JENJANG, MENIT_PER_JP, fase, jenjangDariKelas, semesterSekarang } from '../lib/akademik';
import { useJaringan } from '../lib/offline/jaringan';
import { useAuth } from '../lib/auth';
import type { Jenjang, KelasRingkas } from '../types';

const PERTEMUAN = Array.from({ length: 21 }, (_, i) => i + 4); // 4-24
const JP = [1, 2, 3, 4, 5, 6];

const LABEL: Record<string, string> = {
  judul: 'Judul modul',
  mapel: 'Mata pelajaran',
  jenjang: 'Jenjang',
  kelas: 'Kelas',
  semester: 'Semester',
  jumlahPertemuan: 'Jumlah pertemuan',
  jpPerPertemuan: 'JP per pertemuan',
  topik: 'Cakupan materi',
  tujuanPembelajaran: 'Tujuan pembelajaran',
  kondisiKelas: 'Kondisi kelas',
};

// Isian dibagi tiga langkah supaya formulir tidak terasa panjang. `kolom` = isian yang divalidasi di langkah itu.
const LANGKAH: { judul: string; kolom: string[] }[] = [
  { judul: 'Identitas', kolom: ['jenjang', 'kelas', 'semester', 'mapel', 'jumlahPertemuan', 'jpPerPertemuan', 'judul'] },
  { judul: 'Materi & Tujuan', kolom: ['topik', 'tujuanPembelajaran', 'kondisiKelas'] },
  { judul: 'Periksa & Buat', kolom: [] },
];

interface Isian {
  /** Kelas dari menu Kelas & Nilai yang dipakai sebagai dasar isian ('' = isi manual). */
  kelasId: string;
  judul: string;
  mapel: string;
  jenjang: Jenjang;
  kelas: string;
  semester: string;
  jumlahPertemuan: number;
  jpPerPertemuan: number;
  topik: string;
  tujuanPembelajaran: string;
  kondisiKelas: string;
}

interface Draf {
  f: Isian;
  langkah: number;
  judulManual: boolean;
}

function validasi(f: Isian): Record<string, string> {
  const g: Record<string, string> = {};
  if (f.judul.trim().length < 5) g.judul = 'Judul minimal 5 karakter.';
  if (f.mapel.trim().length < 2) g.mapel = 'Pilih atau tulis mata pelajaran.';
  if (!KELAS_PER_JENJANG[f.jenjang].includes(f.kelas)) g.kelas = 'Pilih kelas.';
  if (f.topik.trim().length < 3) g.topik = 'Tulis materi yang dibahas selama semester, atau minta saran AI.';
  if (f.tujuanPembelajaran.trim().length < 15) g.tujuanPembelajaran = 'Tulis tujuan pembelajaran minimal 15 karakter, atau minta saran AI.';
  return g;
}

const langkahDari = (kolom: string) => Math.max(0, LANGKAH.findIndex((l) => l.kolom.includes(kolom)));

const kunciDraf = (idUser: string) => `ajarin.draf-modul.${idUser}`;

function bacaDraf(idUser: string): Draf | null {
  try {
    const d = JSON.parse(localStorage.getItem(kunciDraf(idUser)) ?? 'null') as Draf | null;
    // Hanya dipulihkan bila guru sudah sempat mengisi sesuatu yang berarti.
    return d?.f && (d.f.kelas || d.f.topik || d.f.tujuanPembelajaran) ? d : null;
  } catch {
    return null;
  }
}

function hapusDraf(idUser: string) {
  try {
    localStorage.removeItem(kunciDraf(idUser));
  } catch {
    /* abaikan */
  }
}

export default function ModulBaru() {
  const { user } = useAuth();
  const idUser = user?.id ?? '';
  const navigate = useNavigate();
  const awal = (): Isian => ({
    kelasId: '',
    judul: '',
    mapel: user?.mapel ?? '',
    jenjang: user?.jenjang ?? 'SMP',
    kelas: '',
    semester: semesterSekarang(),
    jumlahPertemuan: 16,
    jpPerPertemuan: 2,
    topik: '',
    tujuanPembelajaran: '',
    kondisiKelas: '',
  });
  const [draf] = useState(() => bacaDraf(idUser));
  const [dipulihkan, setDipulihkan] = useState(!!draf);
  const [f, setF] = useState<Isian>(() => draf?.f ?? awal());
  const [langkah, setLangkah] = useState(() => draf?.langkah ?? 0);
  // Selama guru belum mengetik judul sendiri, judul disusun otomatis dari mapel, kelas, dan semester.
  const [judulManual, setJudulManual] = useState(() => draf?.judulManual ?? false);
  const [kelasSaya, setKelasSaya] = useState<KelasRingkas[]>([]);
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [peringatan, setPeringatan] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [menyarankan, setMenyarankan] = useState(false);
  const [galat, setGalat] = useState('');
  const [teks, setTeks] = useState('');
  const batal = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { online } = useJaringan();

  // Menghentikan penulisan bila halaman ditinggalkan; server ikut menghentikan AI dan tidak menyimpan apa pun.
  useEffect(() => () => batal.current?.abort(), []);

  useEffect(() => {
    api
      .get('/kelas')
      .then((r) => {
        const daftar = (r.data.kelas as KelasRingkas[]).filter((k) => k.tingkat);
        setKelasSaya(daftar);
        // Draf yang menunjuk kelas yang sudah dihapus: tautannya dilepas, isian lain tetap.
        setF((lama) => (lama.kelasId && !daftar.some((k) => k.id === lama.kelasId) ? { ...lama, kelasId: '' } : lama));
      })
      .catch(() => setKelasSaya([]));
  }, []);

  // Draf tersimpan di perangkat setiap ada perubahan, supaya isian tidak hilang bila halaman tertutup.
  useEffect(() => {
    if (!idUser || sibuk) return;
    try {
      localStorage.setItem(kunciDraf(idUser), JSON.stringify({ f, langkah, judulManual } satisfies Draf));
    } catch {
      /* penyimpanan penuh atau diblokir: draf tidak disimpan */
    }
  }, [f, langkah, judulManual, idUser, sibuk]);

  const kelasTerpilih = kelasSaya.find((k) => k.id === f.kelasId);
  const judulOtomatis = f.kelas
    ? `${f.mapel.trim() || 'Modul Ajar'} Kelas ${kelasTerpilih?.nama ?? f.kelas} Semester ${f.semester}`
    : '';

  useEffect(() => {
    if (!judulManual) setF((lama) => (lama.judul === judulOtomatis ? lama : { ...lama, judul: judulOtomatis }));
  }, [judulOtomatis, judulManual]);

  // Mengubah isian setelah peringatan AI: peringatan untuk kolom itu dihapus, dan pemeriksaan diulang saat dikirim.
  const atur = <K extends keyof Isian>(k: K, v: Isian[K]) => {
    setF((lama) => ({ ...lama, [k]: v }));
    if (kolom[k]) setKolom(({ [k]: _, ...sisa }) => sisa);
    setPeringatan(false);
  };

  // Ganti jenjang: kelas dan mapel yang tidak ada di jenjang baru dikosongkan, dan tautan ke kelas saya dilepas.
  function ubahJenjang(jenjang: Jenjang) {
    setF((lama) => {
      const mapelDaftar = JENJANG.some((j) => MAPEL_PER_JENJANG[j].includes(lama.mapel));
      return {
        ...lama,
        kelasId: '',
        jenjang,
        kelas: KELAS_PER_JENJANG[jenjang].includes(lama.kelas) ? lama.kelas : '',
        mapel: mapelDaftar && !MAPEL_PER_JENJANG[jenjang].includes(lama.mapel) ? '' : lama.mapel,
      };
    });
    setPeringatan(false);
  }

  // Memilih kelas yang sudah dibuat: jenjang, tingkat, dan kondisi kelas (jumlah siswa) terisi otomatis.
  function pilihKelasSaya(id: string) {
    const k = kelasSaya.find((x) => x.id === id);
    if (!k?.tingkat) {
      atur('kelasId', '');
      return;
    }
    const jenjang = jenjangDariKelas(k.tingkat, k.jurusan, user?.jenjang ?? 'SMP');
    setF((lama) => ({
      ...lama,
      kelasId: k.id,
      jenjang,
      kelas: k.tingkat!,
      kondisiKelas: lama.kondisiKelas.trim() ? lama.kondisiKelas : `Kelas ${k.nama}, ${k.jumlahSiswa} siswa`,
    }));
    setKolom(({ kelas: _k, jenjang: _j, ...sisa }) => sisa);
    setPeringatan(false);
  }

  function fokus(g: Record<string, string>) {
    const pertama = Object.keys(LABEL).find((k) => g[k]);
    if (!pertama) return;
    setLangkah(langkahDari(pertama));
    // Tunggu langkahnya tampil dulu.
    window.setTimeout(() => formRef.current?.querySelector<HTMLElement>(`#${pertama}`)?.focus(), 0);
  }

  /** Validasi langkah yang sedang dibuka; true bila boleh lanjut. */
  function periksaLangkah(n: number): boolean {
    const semua = validasi(f);
    const g = Object.fromEntries(Object.entries(semua).filter(([k]) => LANGKAH[n].kolom.includes(k)));
    setKolom(g);
    if (Object.keys(g).length) {
      fokus(g);
      return false;
    }
    return true;
  }

  function lanjut() {
    setGalat('');
    if (periksaLangkah(langkah)) setLangkah((n) => Math.min(n + 1, LANGKAH.length - 1));
  }

  // Lompat lewat penanda langkah: mundur selalu boleh, maju hanya bila langkah-langkah sebelumnya valid.
  function keLangkah(n: number) {
    if (n <= langkah) return setLangkah(n);
    for (let i = langkah; i < n; i++) if (!periksaLangkah(i)) return;
    setLangkah(n);
  }

  async function sarankan() {
    if (f.tujuanPembelajaran.trim() && !window.confirm('Ganti tujuan pembelajaran yang sudah ada dengan saran AI?')) return;
    setGalat('');
    setMenyarankan(true);
    try {
      const r = await api.post('/modul/saran', {
        mapel: f.mapel,
        jenjang: f.jenjang,
        kelas: f.kelas,
        semester: f.semester,
        jumlahPertemuan: f.jumlahPertemuan,
        topik: f.topik.trim() || undefined,
      });
      // Materi yang sudah diketik guru dipertahankan; AI hanya mengisi bila masih kosong.
      setF((lama) => ({ ...lama, topik: lama.topik.trim() ? lama.topik : r.data.topik, tujuanPembelajaran: r.data.tujuanPembelajaran }));
      setKolom(({ topik: _t, tujuanPembelajaran: _p, ...sisa }) => sisa);
      setPeringatan(false);
    } catch (err) {
      const k = kolomError(err);
      if (Object.keys(k).length) {
        setKolom(k);
        fokus(k);
      }
      setGalat(pesanError(err, 'Saran AI belum bisa dibuat. Coba lagi.'));
    } finally {
      setMenyarankan(false);
    }
  }

  async function buat(abaikanPeringatan: boolean) {
    setGalat('');
    const g = validasi(f);
    setKolom(g);
    if (Object.keys(g).length) return fokus(g);

    setTeks('');
    setSibuk(true);
    setPeringatan(false);
    const ctrl = new AbortController();
    batal.current = ctrl;

    // Teks tiba puluhan kali per detik; render Markdown + rumus tiap potongan terlalu berat, jadi diperbarui berkala.
    let buffer = '';
    const segarkan = window.setInterval(() => setTeks(buffer), 250);
    let selesaiId = '';
    try {
      const { kelasId: _, ...isi } = f;
      await postAlir<{ t?: string; id?: string; error?: string }>(
        '/modul/buat-stream',
        { ...isi, kondisiKelas: isi.kondisiKelas.trim() || undefined, abaikanPeringatan: abaikanPeringatan || undefined },
        (b) => {
          if (b.error) throw new Error(b.error);
          if (b.t) buffer += b.t;
          if (b.id) selesaiId = b.id;
        },
        ctrl.signal
      );
      if (!selesaiId) throw new Error('Penulisan modul terhenti sebelum selesai. Coba lagi.');
      hapusDraf(idUser);
      navigate(`/modul/${selesaiId}`);
    } catch (err) {
      if (ctrl.signal.aborted) {
        setGalat('Penyusunan modul dibatalkan.');
      } else {
        const k = kolomError(err);
        setKolom(k);
        if (kodeError(err) === 'PERINGATAN_AI') setPeringatan(true);
        else setGalat(pesanError(err, 'Gagal membuat modul.'));
        // Peringatan AI ditampilkan di langkah Periksa; galat isian membawa guru ke langkah isiannya.
        if (kodeError(err) !== 'PERINGATAN_AI') fokus(k);
      }
      setSibuk(false);
    } finally {
      window.clearInterval(segarkan);
      setTeks(buffer);
    }
  }

  function kirim(e: FormEvent) {
    e.preventDefault();
    if (langkah < LANGKAH.length - 1) lanjut();
    else void buat(false);
  }

  function mulaiBaru() {
    hapusDraf(idUser);
    setF(awal());
    setLangkah(0);
    setJudulManual(false);
    setKolom({});
    setPeringatan(false);
    setGalat('');
    setDipulihkan(false);
  }

  const menit = MENIT_PER_JP[f.jenjang];
  const faseKelas = fase(f.kelas);
  const siapSaran = !!f.kelas && f.mapel.trim().length >= 2;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Buat Modul Ajar</h1>
        <p className="mt-1.5 text-base font-medium text-tinta-500">
          Modul disusun sebagai rencana satu semester: capaian dan tujuan pembelajaran, lalu tabel rencana tiap pertemuan beserta penilaiannya.
        </p>
      </div>

      {dipulihkan && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-ajarin-100 bg-ajarin-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>Isian sebelumnya dipulihkan dari draf di perangkat ini.</span>
          <span className="flex gap-3">
            <button type="button" onClick={() => setDipulihkan(false)} className="font-bold text-ajarin-600 hover:underline">
              Lanjutkan
            </button>
            <button type="button" onClick={mulaiBaru} className="font-bold text-tinta-500 hover:underline">
              Mulai dari awal
            </button>
          </span>
        </div>
      )}

      <ol className="mb-4 grid grid-cols-3 gap-2" aria-label="Langkah pengisian">
        {LANGKAH.map((l, n) => {
          const aktif = n === langkah;
          const lewat = n < langkah;
          return (
            <li key={l.judul}>
              <button
                type="button"
                onClick={() => keLangkah(n)}
                disabled={sibuk}
                aria-current={aktif ? 'step' : undefined}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                  aktif ? 'border-ajarin-500 bg-ajarin-500 text-white' : lewat ? 'border-ajarin-200 bg-ajarin-50 text-ajarin-600' : 'border-tinta-100 bg-white text-tinta-500'
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${aktif ? 'bg-white text-ajarin-600' : lewat ? 'bg-ajarin-500 text-white' : 'bg-tinta-100 text-tinta-500'}`}
                >
                  {lewat ? '✓' : n + 1}
                </span>
                <span className="hidden truncate sm:inline">{l.judul}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mb-3 text-sm font-semibold text-ajarin-600 sm:hidden">
        Langkah {langkah + 1}: {LANGKAH[langkah].judul}
      </p>

      <form ref={formRef} onSubmit={kirim} noValidate className="kartu space-y-5 border-[#E6E6E6] p-4 sm:p-5">
        {langkah === 0 && (
          <>
            {kelasSaya.length > 0 && (
              <Kolom id="kelasId" label="Ambil dari Kelas Saya (opsional)" petunjuk="Jenjang, kelas, dan jumlah siswa terisi otomatis dari kelas yang Anda pilih.">
                <select {...propsKontrol('kelasId', undefined, true)} value={f.kelasId} onChange={(e) => pilihKelasSaya(e.target.value)}>
                  <option value="">Isi manual</option>
                  {kelasSaya.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} · {k.tapel} · {k.jumlahSiswa} siswa
                    </option>
                  ))}
                </select>
              </Kolom>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
                  onChange={(e) => {
                    atur('kelas', e.target.value);
                    atur('kelasId', '');
                  }}
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
              <Kolom id="semester" label="Semester">
                <select {...propsKontrol('semester')} value={f.semester} onChange={(e) => atur('semester', e.target.value)}>
                  <option>Ganjil</option>
                  <option>Genap</option>
                </select>
              </Kolom>
            </div>

            <Kolom id="mapel" label="Mata Pelajaran" galat={kolom.mapel}>
              <PilihMapel key={f.jenjang} id="mapel" jenjang={f.jenjang} value={f.mapel} onChange={(v) => atur('mapel', v)} galat={kolom.mapel} />
            </Kolom>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Kolom id="jumlahPertemuan" label="Jumlah Pertemuan" galat={kolom.jumlahPertemuan} petunjuk="Satu semester umumnya 16–18 pertemuan.">
                <select
                  {...propsKontrol('jumlahPertemuan', kolom.jumlahPertemuan, true)}
                  value={f.jumlahPertemuan}
                  onChange={(e) => atur('jumlahPertemuan', Number(e.target.value))}
                >
                  {PERTEMUAN.map((n) => (
                    <option key={n} value={n}>
                      {n} pertemuan
                    </option>
                  ))}
                </select>
              </Kolom>
              <Kolom
                id="jpPerPertemuan"
                label="Alokasi Waktu per Pertemuan"
                galat={kolom.jpPerPertemuan}
                petunjuk={`1 JP ${f.jenjang} = ${menit} menit. Total ${f.jpPerPertemuan * menit} menit per pertemuan.`}
              >
                <select
                  {...propsKontrol('jpPerPertemuan', kolom.jpPerPertemuan, true)}
                  value={f.jpPerPertemuan}
                  onChange={(e) => atur('jpPerPertemuan', Number(e.target.value))}
                >
                  {JP.map((n) => (
                    <option key={n} value={n}>
                      {n} JP × {menit} menit
                    </option>
                  ))}
                </select>
              </Kolom>
            </div>

            <Kolom
              id="judul"
              label="Judul Modul"
              galat={kolom.judul}
              petunjuk={
                judulManual && judulOtomatis ? (
                  <button
                    type="button"
                    onClick={() => {
                      setJudulManual(false);
                      atur('judul', judulOtomatis);
                    }}
                    className="font-semibold text-ajarin-600 underline"
                  >
                    Pakai judul otomatis: {judulOtomatis}
                  </button>
                ) : (
                  'Terisi otomatis dari mapel, kelas, dan semester. Boleh diubah.'
                )
              }
            >
              <input
                {...propsKontrol('judul', kolom.judul, true)}
                maxLength={150}
                placeholder="Pilih kelas dulu, judul akan terisi otomatis"
                value={f.judul}
                onChange={(e) => {
                  setJudulManual(true);
                  atur('judul', e.target.value);
                }}
              />
            </Kolom>
          </>
        )}

        {langkah === 1 && (
          <>
            <div className="flex flex-col gap-3 rounded-xl border border-ajarin-100 bg-ajarin-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-bold text-ajarin-600">Bingung mengisi? Minta saran AI</p>
                <p className="mt-0.5 text-tinta-500">
                  AI menyarankan materi dan tujuan pembelajaran {f.mapel || ''} kelas {f.kelas} (Fase {faseKelas}) semester {f.semester.toLowerCase()} sesuai CP. Materi
                  yang sudah Anda ketik tetap dipakai.
                </p>
              </div>
              <button type="button" onClick={sarankan} disabled={menyarankan || !online || !siapSaran} className="btn-utama shrink-0 px-5 py-2.5">
                {menyarankan ? 'Menyusun saran...' : 'Sarankan dengan AI'}
              </button>
            </div>

            <Kolom id="topik" label="Cakupan Materi" galat={kolom.topik} petunjuk="Materi pokok yang dibahas selama semester, pisahkan dengan koma.">
              <textarea
                {...propsKontrol('topik', kolom.topik, true)}
                rows={3}
                maxLength={300}
                placeholder="Contoh: bilangan bulat, pecahan, perbandingan, bentuk aljabar, persamaan linear"
                value={f.topik}
                onChange={(e) => atur('topik', e.target.value)}
              />
            </Kolom>

            <Kolom
              id="tujuanPembelajaran"
              label="Tujuan Pembelajaran"
              galat={kolom.tujuanPembelajaran}
              petunjuk="Satu tujuan per baris. AI akan menomorinya menjadi TP-1, TP-2, dan seterusnya."
            >
              <textarea
                {...propsKontrol('tujuanPembelajaran', kolom.tujuanPembelajaran, true)}
                rows={7}
                maxLength={2000}
                placeholder={'Contoh:\nPeserta didik mampu mengoperasikan bilangan bulat dan pecahan.\nPeserta didik mampu menyelesaikan persamaan linear satu variabel.'}
                value={f.tujuanPembelajaran}
                onChange={(e) => atur('tujuanPembelajaran', e.target.value)}
                className={`${propsKontrol('tujuanPembelajaran', kolom.tujuanPembelajaran).className} min-h-[160px]`}
              />
            </Kolom>

            <Kolom id="kondisiKelas" label="Kondisi Kelas (Opsional)" galat={kolom.kondisiKelas} petunjuk="Mis. jumlah siswa, fasilitas, atau kebutuhan khusus.">
              <input
                {...propsKontrol('kondisiKelas', kolom.kondisiKelas, true)}
                maxLength={600}
                placeholder="Contoh: 32 siswa, tanpa proyektor"
                value={f.kondisiKelas}
                onChange={(e) => atur('kondisiKelas', e.target.value)}
              />
            </Kolom>
          </>
        )}

        {langkah === 2 && (
          <dl className="divide-y divide-tinta-100 rounded-xl border border-tinta-100 text-sm">
            <Ringkas label="Judul" langkah={0} keLangkah={keLangkah} galat={kolom.judul}>
              {f.judul}
            </Ringkas>
            <Ringkas label="Kelas" langkah={0} keLangkah={keLangkah} galat={kolom.kelas}>
              {f.jenjang} kelas {f.kelas} (Fase {faseKelas}){kelasTerpilih && ` · ${kelasTerpilih.nama}`} · Semester {f.semester}
            </Ringkas>
            <Ringkas label="Mata pelajaran" langkah={0} keLangkah={keLangkah} galat={kolom.mapel}>
              {f.mapel}
            </Ringkas>
            <Ringkas label="Pertemuan" langkah={0} keLangkah={keLangkah}>
              {f.jumlahPertemuan} pertemuan × {f.jpPerPertemuan} JP ({f.jpPerPertemuan * menit} menit)
            </Ringkas>
            <Ringkas label="Cakupan materi" langkah={1} keLangkah={keLangkah} galat={kolom.topik}>
              {f.topik}
            </Ringkas>
            <Ringkas label="Tujuan pembelajaran" langkah={1} keLangkah={keLangkah} galat={kolom.tujuanPembelajaran}>
              <span className="whitespace-pre-line">{f.tujuanPembelajaran}</span>
            </Ringkas>
            {f.kondisiKelas.trim() && (
              <Ringkas label="Kondisi kelas" langkah={1} keLangkah={keLangkah} galat={kolom.kondisiKelas}>
                {f.kondisiKelas}
              </Ringkas>
            )}
          </dl>
        )}

        {peringatan && (
          <PeringatanAI kolom={kolom} label={LABEL} sibuk={sibuk} onLanjut={() => void buat(true)} teksLanjut="Isian sudah benar, tetap buat modul" />
        )}
        {galat && <Pesan nada="galat">{galat}</Pesan>}

        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          {langkah > 0 && (
            <button type="button" onClick={() => setLangkah((n) => n - 1)} disabled={sibuk} className="btn-garis w-full sm:w-auto">
              Kembali
            </button>
          )}
          {langkah < LANGKAH.length - 1 ? (
            <button type="submit" className="btn-utama w-full py-3 text-base sm:ml-auto sm:w-auto sm:px-10">
              Lanjut
            </button>
          ) : (
            <button type="submit" disabled={sibuk || !online} className="btn-utama w-full py-3.5 text-xl sm:flex-1">
              {sibuk ? 'Memeriksa dan menyusun modul...' : 'Buat Modul'}
            </button>
          )}
          {sibuk && (
            <button type="button" onClick={() => batal.current?.abort()} className="btn-garis w-full sm:w-auto">
              Batalkan
            </button>
          )}
        </div>
        {!online && <Pesan nada="awas">Anda sedang offline. Saran AI dan membuat modul butuh internet; isian tetap tersimpan sebagai draf.</Pesan>}
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

/** Satu baris ringkasan di langkah Periksa, dengan tautan kembali ke langkah isiannya. */
function Ringkas({
  label,
  langkah,
  keLangkah,
  galat,
  children,
}: {
  label: string;
  langkah: number;
  keLangkah: (n: number) => void;
  galat?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr_auto] sm:gap-4">
      <dt className="font-bold text-ajarin-600">{label}</dt>
      <dd className="min-w-0 break-words text-tinta-900">
        {children}
        {galat && <p className="mt-1 text-xs font-semibold text-merah">{galat}</p>}
      </dd>
      <dd>
        <button type="button" onClick={() => keLangkah(langkah)} className="text-xs font-bold text-ajarin-500 hover:underline">
          Ubah
        </button>
      </dd>
    </div>
  );
}
