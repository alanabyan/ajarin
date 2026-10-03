import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { AsesmenSet } from '../types';

export default function BankSoalList() {
  const [sets, setSets] = useState<AsesmenSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/bank-soal').then((res) => {
      setSets(res.data.asesmenSet);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Bank Soal</h1>
        <Link to="/bank-soal/baru" className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900">
          + Set soal baru
        </Link>
      </div>

      {loading ? (
        <p className="text-ink/60">Memuat...</p>
      ) : sets.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-ink/20 p-10 text-center">
          <p className="font-medium mb-1">Belum ada set soal</p>
          <p className="text-sm text-ink/60 mb-4">Hasilkan soal lengkap dengan kunci jawaban dan pembahasan.</p>
          <Link to="/bank-soal/baru" className="text-forest-700 font-medium hover:underline">
            Buat set soal
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map((s) => (
            <Link
              key={s.id}
              to={`/bank-soal/${s.id}`}
              className="block bg-white rounded-lg border border-ink/10 p-4 hover:border-forest-400 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{s.judul}</p>
                {s.googleFormUrl && (
                  <span className="shrink-0 rounded-full bg-forest-50 text-forest-700 text-xs font-medium px-2.5 py-0.5">
                    Sudah ada Google Form
                  </span>
                )}
              </div>
              <p className="text-sm text-ink/60 mt-1">
                {s.mapel} · Kelas {s.kelas} · {s.soal.length} soal
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
