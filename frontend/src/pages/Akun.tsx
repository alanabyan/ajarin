import { FormEvent, ReactNode, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Logo, Pesan } from '../components/ui';
import { pesanError } from '../lib/api';
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

export function Masuk() {
  const { user, masuk, masukDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function jalankan(aksi: () => Promise<void>, cadangan: string) {
    setGalat('');
    setSibuk(true);
    try {
      await aksi();
      navigate('/dashboard');
    } catch (e) {
      setGalat(pesanError(e, cadangan));
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
        {galat && <Pesan nada="galat">{galat}</Pesan>}
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

export function Daftar() {
  const { user, daftar } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ nama: '', email: '', password: '', jenjang: 'SMP' as Jenjang, mapel: '', sekolah: '' });
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const ubah = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat('');
    setSibuk(true);
    try {
      await daftar({ ...f, sekolah: f.sekolah || undefined });
      navigate('/dashboard');
    } catch (err) {
      setGalat(pesanError(err, 'Pendaftaran gagal.'));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Bingkai judul="Daftar" deskripsi="Buat akun gratis untuk mulai menyusun perangkat ajar.">
      <form onSubmit={kirim} className="space-y-4">
        <div>
          <label htmlFor="nama" className="label">
            Nama lengkap
          </label>
          <input id="nama" required minLength={2} autoComplete="name" className="input" value={f.nama} onChange={ubah('nama')} />
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" required autoComplete="email" className="input" value={f.email} onChange={ubah('email')} />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Kata sandi (minimal 8 karakter)
          </label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password" className="input" value={f.password} onChange={ubah('password')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <label htmlFor="mapel" className="label">
              Mata pelajaran
            </label>
            <input id="mapel" required minLength={2} placeholder="mis. Matematika" className="input" value={f.mapel} onChange={ubah('mapel')} />
          </div>
        </div>
        <div>
          <label htmlFor="sekolah" className="label">
            Sekolah (opsional)
          </label>
          <input id="sekolah" className="input" value={f.sekolah} onChange={ubah('sekolah')} />
        </div>
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
