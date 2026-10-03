import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import { ModulAjar } from '../types';

export default function ModulAjarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modul, setModul] = useState<ModulAjar | null>(null);
  const [konten, setKonten] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get(`/modul-ajar/${id}`).then((res) => {
      setModul(res.data.modul);
      setKonten(res.data.modul.kontenDraf);
    });
  }, [id]);

  async function handleSave(status?: 'FINAL') {
    setSaving(true);
    try {
      const res = await client.put(`/modul-ajar/${id}`, { kontenDraf: konten, ...(status && { status }) });
      setModul(res.data.modul);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Hapus modul ajar ini?')) return;
    await client.delete(`/modul-ajar/${id}`);
    navigate('/modul-ajar');
  }

  if (!modul) return <p className="text-ink/60">Memuat...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">{modul.judul}</h1>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            modul.status === 'FINAL' ? 'bg-forest-50 text-forest-700' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {modul.status === 'FINAL' ? 'Final' : 'Draf'}
        </span>
      </div>
      <p className="text-ink/60 mb-6">
        {modul.topik} · Kelas {modul.kelas} · {modul.alokasiWaktu}
      </p>

      <textarea
        value={konten}
        onChange={(e) => setKonten(e.target.value)}
        rows={22}
        className="w-full rounded-lg border border-ink/10 p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-forest-400"
      />

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900 disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan perubahan'}
        </button>
        {modul.status !== 'FINAL' && (
          <button
            onClick={() => handleSave('FINAL')}
            disabled={saving}
            className="rounded-md border border-forest-700 text-forest-700 text-sm px-4 py-2 hover:bg-forest-50"
          >
            Tandai final
          </button>
        )}
        <button onClick={handleDelete} className="text-sm text-red-600 hover:underline ml-auto">
          Hapus
        </button>
      </div>
    </div>
  );
}
