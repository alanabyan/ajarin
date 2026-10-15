import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Kolom, Logo, Pesan, PilihMapel, propsKontrol } from '../components/ui';
import api, { kodeError, kolomError, pesanError } from '../lib/api';
import { JENJANG, MAPEL_PER_JENJANG } from '../lib/akademik';
import { useAuth } from '../lib/auth';
import type { Jenjang } from '../types';

function Bingkai({ judul, deskripsi, children }: { judul: string; deskripsi: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-6 text-3xl font-semibold">{judul}</h1>
        <p className="mb-6 mt-1 text-tinta-500">{deskripsi}</p>
        <div className="kartu">{children}</div>
      </div>
    </div>
  );
}

const EMAIL_VALID = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Tombol kirim ulang tautan verifikasi untuk satu alamat email. */
function KirimUlang({ email }: { email: string }) {
  const [status, setStatus] = useState<{ nada: 'sukses' | 'galat'; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function kirim() {
    setSibuk(true);
    setStatus(null);
    try {
      const r = await api.post('/auth/kirim-ulang', { email });
      setStatus({ nada: 'sukses', teks: r.data.pesan });
    } catch (e) {
      setStatus({ nada: 'galat', teks: pesanError(e, 'Gagal mengirim ulang email.') });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <button type="button" onClick={kirim} disabled={sibuk || !email} className="btn-garis w-full py-2">
        {sibuk ? 'Mengirim...' : 'Kirim ulang email verifikasi'}
      </button>
      {status && <Pesan nada={status.nada}>{status.teks}</Pesan>}
    </div>
  );
}

interface StateMasuk {
  terdaftar?: string;
  terverifikasi?: string;
}

export function Masuk() {
  const { user, masuk, masukDemo } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as StateMasuk;
  const [email, setEmail] = useState(state.terdaftar ?? state.terverifikasi ?? '');
  const [password, setPassword] = useState('');
  const [galat, setGalat] = useState('');
  const [belumVerifikasi, setBelumVerifikasi] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function jalankan(aksi: () => Promise<void>, cadangan: string) {
    setGalat('');
    setBelumVerifikasi(false);
    setSibuk(true);
    try {
      await aksi();
      navigate('/dashboard');
    } catch (e) {
      setGalat(pesanError(e, cadangan));
      setBelumVerifikasi(kodeError(e) === 'BELUM_VERIFIKASI');
    } finally {
      setSibuk(false);
    }
  }

  function kirim(e: FormEvent) {
    e.preventDefault();
    void jalankan(() => masuk(email, password), 'Gagal masuk. Periksa email dan kata sandi.');
  }

  return (
    <Bingkai judul="Masuk" deskripsi="Lanjutkan menyiapkan perangkat ajar Anda.">
      {state.terdaftar && !belumVerifikasi && (
        <div className="mb-5">
          <Pesan nada="sukses">
            Akun berhasil dibuat. Kami mengirim tautan verifikasi ke <b>{state.terdaftar}</b>. Buka email Anda (periksa juga folder Spam), klik
            tautannya, lalu masuk di sini.
          </Pesan>
          <KirimUlang email={state.terdaftar} />
        </div>
      )}
      {state.terverifikasi && (
        <div className="mb-5">
          <Pesan nada="sukses">Email berhasil diverifikasi. Silakan masuk.</Pesan>
        </div>
      )}
      <form onSubmit={kirim} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Kata sandi
          </label>
          <input id="password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {galat && (
          <div>
            <Pesan nada={belumVerifikasi ? 'awas' : 'galat'}>{galat}</Pesan>
            {belumVerifikasi && <KirimUlang email={email.trim().toLowerCase()} />}
          </div>
        )}
        <button type="submit" disabled={sibuk} className="btn-utama w-full">
          {sibuk ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-tinta-300">
        <span className="h-px flex-1 bg-tinta-100" /> atau <span className="h-px flex-1 bg-tinta-100" />
      </div>
      <button type="button" disabled={sibuk} onClick={() => void jalankan(masukDemo, 'Akun demo belum bisa dibuka.')} className="btn-garis w-full">
        Coba akun demo (tanpa daftar)
      </button>
      <p className="mt-5 text-sm text-tinta-500">
        Belum punya akun?{' '}
        <Link to="/daftar" className="font-medium text-tinta-700 underline">
          Daftar
        </Link>
      </p>
    </Bingkai>
  );
}

type IsianDaftar = { nama: string; email: string; password: string; ulangi: string; jenjang: Jenjang; mapel: string; sekolah: string };

function validasiDaftar(f: IsianDaftar): Record<string, string> {
  const g: Record<string, string> = {};
  const nama = f.nama.trim();
  if (nama.length < 2) g.nama = 'Nama minimal 2 karakter.';
  else if (!/^[\p{L} .,'-]+$/u.test(nama)) g.nama = 'Nama hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.';
  if (!EMAIL_VALID.test(f.email.trim())) g.email = 'Format email tidak valid, mis. nama@gmail.com.';
  if (f.password.length < 8) g.password = 'Kata sandi minimal 8 karakter.';
  else if (!/[A-Za-z]/.test(f.password) || !/[0-9]/.test(f.password)) g.password = 'Kata sandi harus mengandung huruf dan angka.';
  if (f.ulangi !== f.password) g.ulangi = 'Kata sandi tidak sama.';
  if (f.mapel.trim().length < 2) g.mapel = 'Pilih atau tulis mata pelajaran.';
  if (f.sekolah.trim().length > 120) g.sekolah = 'Maksimal 120 karakter.';
  return g;
}

function SyaratSandi({ sandi }: { sandi: string }) {
  const syarat: [boolean, string][] = [
    [sandi.length >= 8, 'Minimal 8 karakter'],
    [/[A-Za-z]/.test(sandi), 'Mengandung huruf'],
    [/[0-9]/.test(sandi), 'Mengandung angka'],
  ];
  return (
    <ul id="password-petunjuk" className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {syarat.map(([ok, teks]) => (
        <li key={teks} className={ok ? 'font-semibold text-hijau' : 'text-tinta-500'}>
          {ok ? '✓' : '•'} {teks}
        </li>
      ))}
    </ul>
  );
}

export function Daftar() {
  const { user, daftar } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState<IsianDaftar>({ nama: '', email: '', password: '', ulangi: '', jenjang: 'SMP', mapel: '', sekolah: '' });
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (user) return <Navigate to="/dashboard" replace />;

  const atur = <K extends keyof IsianDaftar>(k: K, v: IsianDaftar[K]) => {
    setF((lama) => ({ ...lama, [k]: v }));
    if (kolom[k]) setKolom(({ [k]: _, ...sisa }) => sisa);
  };

  // Ganti jenjang: mapel dari daftar jenjang lama yang tidak ada di jenjang baru dikosongkan.
  function ubahJenjang(j: Jenjang) {
    const dariDaftar = JENJANG.some((x) => MAPEL_PER_JENJANG[x].includes(f.mapel));
    atur('jenjang', j);
    if (dariDaftar && !MAPEL_PER_JENJANG[j].includes(f.mapel)) atur('mapel', '');
  }

  function fokusGalat(g: Record<string, string>) {
    const pertama = Object.keys(g)[0];
    if (pertama) formRef.current?.querySelector<HTMLElement>(`#${pertama}`)?.focus();
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat('');
    const g = validasiDaftar(f);
    setKolom(g);
    if (Object.keys(g).length) return fokusGalat(g);
    setSibuk(true);
    try {
      const { ulangi: _, ...data } = f;
      const email = await daftar({ ...data, nama: data.nama.trim(), email: data.email.trim(), sekolah: data.sekolah.trim() || undefined });
      navigate('/masuk', { state: { terdaftar: email } satisfies StateMasuk });
    } catch (err) {
      const k = kolomError(err);
      setKolom(k);
      setGalat(pesanError(err, 'Pendaftaran gagal.'));
      fokusGalat(k);
      setSibuk(false);
    }
  }

  return (
    <Bingkai judul="Daftar" deskripsi="Buat akun gratis untuk mulai menyusun perangkat ajar.">
      <form ref={formRef} onSubmit={kirim} noValidate className="space-y-4">
        <Kolom id="nama" label="Nama lengkap" galat={kolom.nama}>
          <input {...propsKontrol('nama', kolom.nama)} autoComplete="name" maxLength={100} value={f.nama} onChange={(e) => atur('nama', e.target.value)} />
        </Kolom>
        <Kolom id="email" label="Email" galat={kolom.email} petunjuk="Tautan verifikasi akan dikirim ke email ini.">
          <input
            {...propsKontrol('email', kolom.email, true)}
            type="email"
            autoComplete="email"
            maxLength={120}
            placeholder="nama@gmail.com"
            value={f.email}
            onChange={(e) => atur('email', e.target.value)}
          />
        </Kolom>
        <div>
          <label htmlFor="password" className="label">
            Kata sandi
          </label>
          <input
            {...propsKontrol('password', kolom.password, true)}
            type="password"
            autoComplete="new-password"
            maxLength={72}
            value={f.password}
            onChange={(e) => atur('password', e.target.value)}
          />
          {kolom.password ? (
            <p id="password-galat" role="alert" className="mt-1.5 text-xs font-semibold text-merah">
              {kolom.password}
            </p>
          ) : (
            <SyaratSandi sandi={f.password} />
          )}
        </div>
        <Kolom id="ulangi" label="Ulangi kata sandi" galat={kolom.ulangi}>
          <input {...propsKontrol('ulangi', kolom.ulangi)} type="password" autoComplete="new-password" maxLength={72} value={f.ulangi} onChange={(e) => atur('ulangi', e.target.value)} />
        </Kolom>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Kolom id="jenjang" label="Jenjang">
            <select {...propsKontrol('jenjang')} value={f.jenjang} onChange={(e) => ubahJenjang(e.target.value as Jenjang)}>
              {JENJANG.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
          </Kolom>
          <Kolom id="mapel" label="Mata pelajaran" galat={kolom.mapel}>
            <PilihMapel id="mapel" jenjang={f.jenjang} value={f.mapel} onChange={(v) => atur('mapel', v)} galat={kolom.mapel} />
          </Kolom>
        </div>
        <Kolom id="sekolah" label="Sekolah (opsional)" galat={kolom.sekolah}>
          <input {...propsKontrol('sekolah', kolom.sekolah)} maxLength={120} placeholder="mis. SMK Negeri 1 Contoh" value={f.sekolah} onChange={(e) => atur('sekolah', e.target.value)} />
        </Kolom>
        {galat && <Pesan nada="galat">{galat}</Pesan>}
        <button type="submit" disabled={sibuk} className="btn-utama w-full">
          {sibuk ? 'Memproses...' : 'Daftar'}
        </button>
      </form>
      <p className="mt-5 text-sm text-tinta-500">
        Sudah punya akun?{' '}
        <Link to="/masuk" className="font-medium text-tinta-700 underline">
          Masuk
        </Link>
      </p>
    </Bingkai>
  );
}

/** Halaman tujuan tautan di email verifikasi: /verifikasi?token=... */
export function Verifikasi() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const token = sp.get('token') ?? '';
  const [hasil, setHasil] = useState<{ ok: boolean; teks: string; email?: string; kedaluwarsa?: boolean } | null>(null);
  const dikirim = useRef(false);

  useEffect(() => {
    // Sekali saja, juga di StrictMode: token hanya berlaku satu kali.
    if (dikirim.current) return;
    dikirim.current = true;
    if (!token) {
      setHasil({ ok: false, teks: 'Tautan verifikasi tidak lengkap. Buka tautan langsung dari email Anda.' });
      return;
    }
    api
      .post('/auth/verifikasi', { token })
      .then((r) => setHasil({ ok: true, teks: 'Email Anda berhasil diverifikasi.', email: r.data.email }))
      .catch((e) => {
        const data = (e as { response?: { data?: { email?: string } } }).response?.data;
        setHasil({ ok: false, teks: pesanError(e, 'Verifikasi gagal.'), email: data?.email, kedaluwarsa: kodeError(e) === 'KEDALUWARSA' });
      });
  }, [token]);

  return (
    <Bingkai judul="Verifikasi email" deskripsi="Satu langkah lagi sebelum Anda bisa masuk.">
      {!hasil ? (
        <p className="text-tinta-500">Memverifikasi...</p>
      ) : hasil.ok ? (
        <div className="space-y-4">
          <Pesan nada="sukses">{hasil.teks}</Pesan>
          <button type="button" className="btn-utama w-full" onClick={() => navigate('/masuk', { state: { terverifikasi: hasil.email } satisfies StateMasuk })}>
            Lanjut masuk
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <Pesan nada="galat">{hasil.teks}</Pesan>
          {hasil.kedaluwarsa && hasil.email && <KirimUlang email={hasil.email} />}
          <Link to="/masuk" className="btn-garis w-full">
            Ke halaman masuk
          </Link>
        </div>
      )}
    </Bingkai>
  );
}
