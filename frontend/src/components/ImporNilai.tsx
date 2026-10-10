import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pesan, angka } from './ui';
import api, { pesanError } from '../lib/api';
import { mintaTokenGoogle } from '../lib/google';
import type { JenisNilai } from '../types';

interface Baris {
  siswaId: string;
  nama: string;
  nis: string;
  skor: number;
  waktu: string;
}

interface Analisis {
  butirId: string;
  urutan: number;
  materi: string;
  persenBenar: number | null;
}

interface Hasil {
  hasil: Baris[];
  belumMengisi: { siswaId: string; nama: string; nis: string }[];
  analisis: Analisis[];
  takDikenal: number;
  tanpaNama: number;
  kelas: { id: string; nama: string; kkm: number };
}

const JENIS: JenisNilai[] = ['Tugas', 'UH', 'UTS', 'UAS'];

// Jawaban Google Form sudah terhubung ke siswa lewat dropdown nama, jadi guru tinggal memeriksa dan menyimpan.
export default function ImporNilai({ setId, mapel, namaKelas }: { setId: string; mapel: string; namaKelas: string }) {
  const navigate = useNavigate();
  const [mapelNilai, setMapelNilai] = useState(mapel);
  const [jenis, setJenis] = useState<JenisNilai>('UH');
  const [data, setData] = useState<Hasil | null>(null);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [hanyaRemedial, setHanyaRemedial] = useState(true);

  const rata = useMemo(() => {
    const terpilih = data?.hasil.filter((b) => dipilih.has(b.siswaId)) ?? [];
    return terpilih.length ? terpilih.reduce((t, b) => t + b.skor, 0) / terpilih.length : 0;
  }, [data, dipilih]);

  async function ambil() {
    setSibuk(true);
    setGalat('');
    setInfo('');
    try {
      const accessToken = await mintaTokenGoogle();
      const r = await api.post(`/soal/${setId}/hasil/ambil`, { accessToken });
      const d: Hasil = r.data;
      setData(d);
      setDipilih(new Set(d.hasil.map((b) => b.siswaId)));
    } catch (e) {
      setGalat(pesanError(e, 'Gagal mengambil jawaban.'));
    } finally {
      setSibuk(false);
    }
  }

  async function simpan() {
    if (!data) return;
    setSibuk(true);
    setGalat('');
    try {
      const items = data.hasil.filter((b) => dipilih.has(b.siswaId)).map((b) => ({ siswaId: b.siswaId, nilai: b.skor }));
      const r = await api.post(`/soal/${setId}/hasil/simpan`, {
        jenis,
        mapel: mapelNilai.trim(),
        items,
        analisis: data.analisis.map((a) => ({ butirId: a.butirId, persenBenar: a.persenBenar })),
      });
      const bagian = [r.data.dibuat > 0 && `${r.data.dibuat} nilai baru`, r.data.diperbarui > 0 && `${r.data.diperbarui} nilai diperbarui`].filter(Boolean);
      setInfo(`Tersimpan di ${jenis} ${mapelNilai.trim()} kelas ${data.kelas.nama}: ${bagian.join(', ')}.`);
      setData(null);
    } catch (e) {
      setGalat(pesanError(e, 'Gagal menyimpan nilai.'));
    } finally {
      setSibuk(false);
    }
  }

  function ubahPilihan(id: string) {
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  }

  const lemah = (data?.analisis ?? []).filter((a) => a.persenBenar !== null && a.persenBenar < 60).sort((a, b) => a.persenBenar! - b.persenBenar!);
  const jumlahRemedial = Math.min(20, Math.max(3, lemah.length * 3));
  const bawahKkm = (data?.hasil ?? []).filter((b) => b.skor < data!.kelas.kkm);
  const untukSebagian = hanyaRemedial && bawahKkm.length > 0;

  // Membuat set soal baru yang melatih konsep dari soal-soal yang paling banyak dijawab salah.
  async function buatRemedial() {
    setSibuk(true);
    setGalat('');
    try {
      const r = await api.post(`/soal/${setId}/remedial`, {
        butirIds: lemah.slice(0, 10).map((a) => a.butirId),
        jumlah: jumlahRemedial,
        ...(untukSebagian ? { siswaIds: bawahKkm.map((b) => b.siswaId) } : {}),
      });
      navigate(`/soal/${r.data.id}`);
    } catch (e) {
      setGalat(pesanError(e, 'Gagal membuat soal remedial.'));
      setSibuk(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-tinta-500">
        Siswa kelas {namaKelas} memilih namanya dari dropdown di form, jadi setiap jawaban otomatis terhubung ke siswa yang benar.
        Nilai yang sudah ada (siswa, mapel, jenis, dan judul yang sama) diperbarui, bukan digandakan.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="imp-mapel" className="label">
            Mata pelajaran
          </label>
          <input id="imp-mapel" className="input" value={mapelNilai} onChange={(e) => setMapelNilai(e.target.value)} />
        </div>
        <div>
          <label htmlFor="imp-jenis" className="label">
            Jenis
          </label>
          <select id="imp-jenis" className="input" value={jenis} onChange={(e) => setJenis(e.target.value as JenisNilai)}>
            {JENIS.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" onClick={ambil} disabled={sibuk} className="btn-utama w-full">
            {sibuk && !data ? 'Mengambil...' : data ? 'Ambil ulang' : 'Ambil jawaban'}
          </button>
        </div>
      </div>

      {galat && <Pesan nada="galat">{galat}</Pesan>}
      {info && <Pesan nada="sukses">{info}</Pesan>}

      {data && data.hasil.length === 0 && <Pesan>Belum ada jawaban yang masuk di Google Form.</Pesan>}

      {data && data.hasil.length > 0 && (
        <>
          {lemah.length > 0 && (
            <div className="rounded-xl border border-pelita-400/50 bg-pelita-50 p-4">
              <p className="font-semibold text-pelita-700">Materi yang perlu diulang</p>
              <p className="mb-2 text-sm text-tinta-700">Soal yang dijawab benar kurang dari 60% siswa:</p>
              <ul className="space-y-1 text-sm">
                {lemah.map((a) => (
                  <li key={a.butirId}>
                    <b>Soal {a.urutan}</b> ({a.persenBenar}% benar) · {a.materi}
                  </li>
                ))}
              </ul>
              {bawahKkm.length > 0 && (
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={hanyaRemedial} onChange={(e) => setHanyaRemedial(e.target.checked)} />
                  <span>
                    Khusus <b>{bawahKkm.length} siswa di bawah KKM ({data!.kelas.kkm})</b>: form remedial hanya memuat nama mereka.
                    <span className="block text-xs text-tinta-500">{bawahKkm.map((b) => b.nama).join(', ')}</span>
                  </span>
                </label>
              )}
              <button type="button" onClick={buatRemedial} disabled={sibuk} className="btn-aksen mt-3">
                {sibuk ? 'Menyusun soal remedial (bisa sampai 30 detik)...' : `Buat ${jumlahRemedial} soal remedial`}
              </button>
              <p className="mt-1 text-xs text-tinta-500">Soal baru melatih konsep yang sama dengan angka dan konteks berbeda, lengkap dengan pembahasan langkah demi langkah.</p>
            </div>
          )}

          <details className="rounded-xl border border-tinta-100 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium">Analisis semua soal</summary>
            <ul className="mt-3 space-y-2">
              {data.analisis.map((a) => (
                <li key={a.butirId} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0">Soal {a.urutan}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-tinta-50">
                    <span
                      className={`block h-full ${a.persenBenar !== null && a.persenBenar < 60 ? 'bg-red-400' : 'bg-emerald-500'}`}
                      style={{ width: `${a.persenBenar ?? 0}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums">{a.persenBenar === null ? '–' : `${a.persenBenar}%`}</span>
                </li>
              ))}
            </ul>
          </details>

          <p className="text-sm text-tinta-700">
            {data.hasil.length} dari {data.hasil.length + data.belumMengisi.length} siswa sudah mengisi · rata-rata{' '}
            {angka(rata)} · {dipilih.size} akan disimpan
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-tinta-100 text-xs text-tinta-500">
                  <th className="w-10 py-1 pr-2">
                    <span className="sr-only">Simpan</span>
                  </th>
                  <th className="py-1 pr-3">Siswa</th>
                  <th className="py-1 text-right">Skor</th>
                </tr>
              </thead>
              <tbody>
                {data.hasil.map((b) => (
                  <tr key={b.siswaId} className="border-b border-tinta-50">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`Simpan nilai ${b.nama}`}
                        checked={dipilih.has(b.siswaId)}
                        onChange={() => ubahPilihan(b.siswaId)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      {b.nama} <span className="text-tinta-300">· {b.nis}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{angka(b.skor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.belumMengisi.length > 0 && (
            <div className="rounded-lg border border-tinta-100 bg-tinta-50 p-3 text-sm">
              <p className="font-medium">Belum mengisi ({data.belumMengisi.length})</p>
              <p className="mt-1 text-tinta-700">{data.belumMengisi.map((s) => s.nama).join(', ')}</p>
            </div>
          )}
          {(data.takDikenal > 0 || data.tanpaNama > 0) && (
            <Pesan nada="awas">
              {data.takDikenal > 0 && `${data.takDikenal} jawaban dilewati karena siswanya sudah dihapus dari kelas. `}
              {data.tanpaNama > 0 && `${data.tanpaNama} jawaban dilewati karena tidak memilih nama.`}
            </Pesan>
          )}

          <button type="button" onClick={simpan} disabled={sibuk || dipilih.size === 0 || !mapelNilai.trim()} className="btn-aksen">
            {sibuk ? 'Menyimpan...' : `Simpan ${dipilih.size} nilai`}
          </button>
        </>
      )}
    </div>
  );
}
