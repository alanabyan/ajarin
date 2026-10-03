import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { ModulAjar } from '../types';

export default function ModulAjarList() {
  const [modul, setModul] = useState<ModulAjar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/modul-ajar').then((res) => {
      setModul(res.data.modul);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Modul Ajar</h1>
        <Link to="/modul-ajar/baru" className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900">
          + Modul baru
        </Link>
      </div>

      {loading ? (
        <p className="text-ink/60">Memuat...</p>
      ) : modul.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-ink/20 p-10 text-center">
          <p className="font-medium mb-1">Belum ada modul ajar</p>
          <p className="text-sm text-ink/60 mb-4">Buat modul pertamamu dari topik dan tujuan pembelajaran.</p>
          <Link to="/modul-ajar/baru" className="text-forest-700 font-medium hover:underline">
            Buat modul ajar
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {modul.map((m) => (
            <Link
              key={m.id}
              to={`/modul-ajar/${m.id}`}
              className="block bg-white rounded-lg border border-ink/10 p-4 hover:border-forest-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{m.judul}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'FINAL' ? 'bg-forest-50 text-forest-700' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {m.status === 'FINAL' ? 'Final' : 'Draf'}
                </span>
              </div>
              <p className="text-sm text-ink/60 mt-1">
                {m.topik} · Kelas {m.kelas} · {m.alokasiWaktu}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
