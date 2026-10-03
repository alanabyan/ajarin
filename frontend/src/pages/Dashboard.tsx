import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ modul: 0, soal: 0, kelas: 0 });

  useEffect(() => {
    Promise.all([client.get('/modul-ajar'), client.get('/bank-soal'), client.get('/kelas')]).then(
      ([modulRes, soalRes, kelasRes]) => {
        setCounts({
          modul: modulRes.data.modul.length,
          soal: soalRes.data.asesmenSet.length,
          kelas: kelasRes.data.kelas.length,
        });
      }
    );
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Halo, {user?.nama?.split(' ')[0]}</h1>
      <p className="text-ink/60 mb-8">Berikut ringkasan perangkat ajar yang sudah kamu siapkan.</p>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Modul ajar" value={counts.modul} />
        <StatCard label="Set soal" value={counts.soal} />
        <StatCard label="Kelas" value={counts.kelas} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <QuickLink to="/modul-ajar/baru" title="Buat modul ajar" desc="Susun draf modul dari topik dan tujuan pembelajaran." />
        <QuickLink to="/bank-soal/baru" title="Buat set soal" desc="Hasilkan soal beserta kunci jawaban dan pembahasan." />
        <QuickLink to="/kelas" title="Kelola kelas" desc="Tambahkan siswa dan catat nilai per kelas." />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-ink/10 p-5">
      <p className="text-3xl font-display text-forest-700">{value}</p>
      <p className="text-sm text-ink/60 mt-1">{label}</p>
    </div>
  );
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="block bg-white rounded-lg border border-ink/10 p-5 hover:border-forest-400 transition-colors">
      <p className="font-medium mb-1">{title}</p>
      <p className="text-sm text-ink/60">{desc}</p>
    </Link>
  );
}
