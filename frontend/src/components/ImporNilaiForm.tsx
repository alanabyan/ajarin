import { useEffect, useState } from 'react';
import client from '../api/client';
import { loadGoogleIdentity, requestGoogleAccessToken } from '../api/googleAuth';
import { Kelas } from '../types';

interface BarisHasil {
  nama: string;
  nis: string;
  skor: number;
  siswaId: string | null;
  namaSiswa: string | null;
}

interface Props {
  asesmenSetId: string;
  mapel: string;
  judul: string;
}

const JENIS = ['Tugas', 'UH', 'UTS', 'UAS'];

// Mengambil jawaban siswa dari Google Form, mencocokkannya ke daftar siswa satu kelas, lalu
// menyimpan skornya sebagai nilai setelah guru memeriksa pratinjau.
export default function ImporNilaiForm({ asesmenSetId, mapel, judul }: Props) {
  const [terbuka, setTerbuka] = useState(false);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [kelasId, setKelasId] = useState('');
  const [mapelNilai, setMapelNilai] = useState(mapel);
  const [jenis, setJenis] = useState('UH');
  const [baris, setBaris] = useState<BarisHasil[] | null>(null);
  const [adaIdentitas, setAdaIdentitas] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    if (!terbuka || kelasList.length > 0) return;
    loadGoogleIdentity().catch(() => {});
    client.get('/kelas').then((res) => {
      setKelasList(res.data.kelas);
      if (res.data.kelas[0]) setKelasId(res.data.kelas[0].id);
    });
  }, [terbuka, kelasList.length]);

  async function ambilJawaban() {
    setSibuk(true);
    setError(null);
    setPesan(null);
    setBaris(null);
    try {
      const accessToken = await requestGoogleAccessToken(true);
      const res = await client.post(`/bank-soal/${asesmenSetId}/google-form/hasil`, { accessToken, kelasId });
      setBaris(res.data.hasil);
      setAdaIdentitas(res.data.adaIdentitas);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Gagal mengambil jawaban.');
    } finally {
      setSibuk(false);
    }
  }

  const cocok = baris?.filter((b) => b.siswaId) ?? [];

  async function simpan() {
    if (cocok.length === 0 || !mapelNilai.trim()) return;
    setSibuk(true);
    setError(null);
    try {
      const res = await client.post('/nilai/batch', {
        kelasId,
        mapel: mapelNilai.trim(),
        jenis,
        items: cocok.map((b) => ({ siswaId: b.siswaId, nilai: b.skor })),
      });
      setPesan(`${res.data.jumlah} nilai berhasil disimpan ke ${jenis} ${mapelNilai.trim()}.`);
      setBaris(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Gagal menyimpan nilai.');
    } finally {
      setSibuk(false);
    }
  }

  if (!terbuka) {
    return (
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className="mb-4 rounded-md border border-forest-700 text-forest-700 text-sm px-4 py-2 hover:bg-forest-50"
      >
        Impor nilai dari Google Form
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-md border border-ink/10 bg-white p-4 text-sm space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium">Impor nilai: {judul}</p>
        <button type="button" onClick={() => setTerbuka(false)} className="text-ink/50 hover:text-ink">
          Tutup
        </button>
      </div>
      <p className="text-ink/60">
        Siswa dikenali dari isian Nama dan NIS di form. Form yang dibuat sebelum fitur ini tidak memilikinya,
        sehingga siswa hanya bisa dicocokkan lewat nama kalau ada.
      </p>

      {kelasList.length === 0 ? (
        <p className="text-ink/60">Belum ada kelas. Buat kelas dan tambahkan siswa dulu di menu Kelas.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs text-ink/60 mb-1">Kelas</span>
            <select
              value={kelasId}
              onChange={(e) => setKelasId(e.target.value)}
              className="rounded-md border border-ink/20 px-2 py-1.5"
            >
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} ({k.tapel})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-ink/60 mb-1">Mata pelajaran</span>
            <input
              value={mapelNilai}
              onChange={(e) => setMapelNilai(e.target.value)}
              className="rounded-md border border-ink/20 px-2 py-1.5"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink/60 mb-1">Jenis</span>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              className="rounded-md border border-ink/20 px-2 py-1.5"
            >
              {JENIS.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={ambilJawaban}
            disabled={sibuk || !kelasId}
            className="rounded-md bg-forest-700 text-white px-4 py-1.5 hover:bg-forest-800 disabled:opacity-50"
          >
            {sibuk && !baris ? 'Mengambil...' : 'Ambil jawaban'}
          </button>
        </div>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 text-red-700 p-3">{error}</div>}
      {pesan && <div className="rounded-md border border-forest-700/30 bg-forest-50 text-forest-700 p-3">{pesan}</div>}

      {baris && (
        <div className="space-y-3">
          {!adaIdentitas && (
            <p className="text-amber-700">
              Form ini tidak punya isian Nama/NIS, jadi pencocokan mungkin tidak ada yang berhasil.
            </p>
          )}
          {baris.length === 0 ? (
            <p className="text-ink/60">Belum ada jawaban yang masuk.</p>
          ) : (
            <>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-ink/60 border-b border-ink/10">
                    <th className="py-1 pr-3">Isian siswa</th>
                    <th className="py-1 pr-3">Dicocokkan ke</th>
                    <th className="py-1 text-right">Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b, i) => (
                    <tr key={i} className="border-b border-ink/5">
                      <td className="py-1 pr-3">
                        {b.nama || '(tanpa nama)'} {b.nis && <span className="text-ink/50">· {b.nis}</span>}
                      </td>
                      <td className={`py-1 pr-3 ${b.siswaId ? '' : 'text-red-600'}`}>
                        {b.namaSiswa ?? 'Tidak cocok (dilewati)'}
                      </td>
                      <td className="py-1 text-right">{b.skor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={simpan}
                  disabled={sibuk || cocok.length === 0}
                  className="rounded-md bg-forest-700 text-white px-4 py-1.5 hover:bg-forest-800 disabled:opacity-50"
                >
                  Simpan {cocok.length} nilai
                </button>
                {cocok.length < baris.length && (
                  <span className="text-ink/60">
                    {baris.length - cocok.length} jawaban tidak cocok dan tidak disimpan.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
