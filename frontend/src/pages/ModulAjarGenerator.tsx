import { FormEvent, ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import client from '../api/client';

export default function ModulAjarGenerator() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    judul: '',
    topik: '',
    jenjang: 'SMP',
    kelas: '',
    alokasiWaktu: '2 x 40 menit',
    kondisiKelas: '',
    tujuanPembelajaran: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasil, setHasil] = useState<{ id: string; kontenDraf: string } | null>(null);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/modul-ajar/generate', form);
      setHasil(res.data.modul);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat draf modul. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  if (hasil) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Draf modul ajar</h1>
          <button
            onClick={() => navigate(`/modul-ajar/${hasil.id}`)}
            className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900"
          >
            Buka dan edit
          </button>
        </div>
        <div className="bg-white rounded-lg border border-ink/10 p-6 prose prose-sm max-w-none prose-headings:font-display">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {hasil.kontenDraf}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Buat modul ajar</h1>
      <p className="text-ink/60 mb-6">Isi detail singkat, sistem akan menyusun draf yang bisa kamu edit.</p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg border border-ink/10 p-6">
        <Field label="Judul modul">
          <input required value={form.judul} onChange={(e) => update('judul', e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Jenjang">
            <select value={form.jenjang} onChange={(e) => update('jenjang', e.target.value)} className="input">
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
              <option value="SMK">SMK</option>
            </select>
          </Field>
          <Field label="Kelas">
            <input
              required
              value={form.kelas}
              onChange={(e) => update('kelas', e.target.value)}
              className="input"
              placeholder="Contoh: 8B"
            />
          </Field>
        </div>
        <Field label="Topik">
          <input required value={form.topik} onChange={(e) => update('topik', e.target.value)} className="input" />
        </Field>
        <Field label="Tujuan pembelajaran">
          <textarea
            required
            value={form.tujuanPembelajaran}
            onChange={(e) => update('tujuanPembelajaran', e.target.value)}
            rows={2}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Alokasi waktu">
            <input
              required
              value={form.alokasiWaktu}
              onChange={(e) => update('alokasiWaktu', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Kondisi kelas (opsional)">
            <input
              value={form.kondisiKelas}
              onChange={(e) => update('kondisiKelas', e.target.value)}
              className="input"
              placeholder="Contoh: tanpa proyektor"
            />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-forest-700 text-white py-2 text-sm font-medium hover:bg-forest-900 disabled:opacity-50"
        >
          {loading ? 'Menyusun draf...' : 'Susun draf modul'}
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
