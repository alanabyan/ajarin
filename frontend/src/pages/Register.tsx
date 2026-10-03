import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nama: '',
    email: '',
    password: '',
    jenjang: 'SMP',
    mapel: '',
    sekolah: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal mendaftar. Periksa kembali data yang diisi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-forest-700 mb-1">Daftar Ajarin</h1>
        <p className="text-ink/60 mb-8">Buat akun untuk mulai menyiapkan perangkat ajar.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama lengkap</label>
            <input required value={form.nama} onChange={(e) => update('nama', e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kata sandi</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Jenjang</label>
              <select value={form.jenjang} onChange={(e) => update('jenjang', e.target.value)} className="input">
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
                <option value="SMK">SMK</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mata pelajaran</label>
              <input required value={form.mapel} onChange={(e) => update('mapel', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sekolah (opsional)</label>
            <input value={form.sekolah} onChange={(e) => update('sekolah', e.target.value)} className="input" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-forest-700 text-white py-2 text-sm font-medium hover:bg-forest-900 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>
        <p className="text-sm text-ink/60 mt-6">
          Sudah punya akun?{' '}
          <Link to="/masuk" className="text-forest-700 font-medium hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
