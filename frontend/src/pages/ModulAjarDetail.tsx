import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import ModulEditor from '../components/ModulEditor';
import ModulPdfPreview from '../components/ModulPdfPreview';
import { ModulAjar } from '../types';

export default function ModulAjarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modul, setModul] = useState<ModulAjar | null>(null);
  const [konten, setKonten] = useState('');
  const [tersimpan, setTersimpan] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);
  const [cetak, setCetak] = useState(false);

  useEffect(() => {
    client.get(`/modul-ajar/${id}`).then((res) => {
      setModul(res.data.modul);
      setKonten(res.data.modul.kontenDraf);
    });
  }, [id]);

  const adaPerubahan = tersimpan !== null && konten !== tersimpan;

  // Peringatan jika menutup/memuat ulang tab saat masih ada perubahan yang belum disimpan.
  useEffect(() => {
    if (!adaPerubahan) return;
    const peringatkan = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', peringatkan);
    return () => window.removeEventListener('beforeunload', peringatkan);
  }, [adaPerubahan]);

  async function handleSave(status?: 'FINAL') {
    setSaving(true);
    setPesan(null);
    try {
      const res = await client.put(`/modul-ajar/${id}`, { kontenDraf: konten, ...(status && { status }) });
      setModul(res.data.modul);
      setTersimpan(konten);
      setPesan({ tipe: 'ok', teks: status ? 'Ditandai final dan tersimpan.' : 'Perubahan tersimpan.' });
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err?.response?.data?.error || 'Gagal menyimpan. Coba lagi.' });
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
      <p className="text-ink/60 mb-4">
        {modul.topik} · Kelas {modul.kelas} · {modul.alokasiWaktu}
      </p>

      <ModulEditor
        key={modul.id}
        nilaiAwal={modul.kontenDraf}
        onChange={setKonten}
        onReady={(md) => {
          setTersimpan(md);
          setKonten(md);
        }}
        onSimpan={() => handleSave()}
      />

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          onClick={() => handleSave()}
          disabled={saving || !adaPerubahan}
          className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900 disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan perubahan'}
        </button>
        {modul.status !== 'FINAL' && (
          <button
            onClick={() => handleSave('FINAL')}
            disabled={saving}
            className="rounded-md border border-forest-700 text-forest-700 text-sm px-4 py-2 hover:bg-forest-50 disabled:opacity-50"
          >
            Tandai final
          </button>
        )}
        <button
          onClick={() => setCetak(true)}
          className="rounded-md border border-forest-700 text-forest-700 text-sm px-4 py-2 hover:bg-forest-50"
        >
          Unduh PDF
        </button>

        <span className="text-sm" role="status">
          {adaPerubahan ? (
            <span className="text-amber-600">● Ada perubahan yang belum disimpan (Ctrl+S)</span>
          ) : pesan ? (
            <span className={pesan.tipe === 'ok' ? 'text-forest-700' : 'text-red-600'}>{pesan.teks}</span>
          ) : null}
        </span>

        <button onClick={handleDelete} className="text-sm text-red-600 hover:underline ml-auto">
          Hapus
        </button>
      </div>

      {cetak && <ModulPdfPreview modul={modul} konten={konten} onTutup={() => setCetak(false)} />}
    </div>
  );
}
