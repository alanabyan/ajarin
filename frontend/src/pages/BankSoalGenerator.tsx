import { FormEvent, ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function BankSoalGenerator() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    judul: '',
    mapel: '',
    kelas: '',
    materi: '',
    tingkatKesulitan: 'sedang',
    jumlahSoal: 5,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/bank-soal/generate', form);
      navigate(`/bank-soal/${res.data.asesmenSet.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat soal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Buat set soal</h1>
      <p className="text-ink/60 mb-6">Sistem akan menyusun soal pilihan ganda beserta kunci jawaban dan pembahasan.</p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg border border-ink/10 p-6">
        <Field label="Judul set soal">
          <input required value={form.judul} onChange={(e) => update('judul', e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mata pelajaran">
            <input required value={form.mapel} onChange={(e) => update('mapel', e.target.value)} className="input" />
          </Field>
          <Field label="Kelas">
            <input required value={form.kelas} onChange={(e) => update('kelas', e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Materi">
          <input required value={form.materi} onChange={(e) => update('materi', e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tingkat kesulitan">
            <select
              value={form.tingkatKesulitan}
              onChange={(e) => update('tingkatKesulitan', e.target.value)}
              className="input"
            >
              <option value="mudah">Mudah</option>
              <option value="sedang">Sedang</option>
              <option value="sulit">Sulit</option>
            </select>
          </Field>
          <Field label="Jumlah soal">
            <input
              type="number"
              min={1}
              max={20}
              value={form.jumlahSoal}
              onChange={(e) => update('jumlahSoal', Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-forest-700 text-white py-2 text-sm font-medium hover:bg-forest-900 disabled:opacity-50"
        >
          {loading ? 'Menyusun soal...' : 'Susun soal'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
