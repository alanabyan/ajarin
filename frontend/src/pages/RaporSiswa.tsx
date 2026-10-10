import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header, Memuat, Pesan, angka, tanggal } from '../components/ui';
import api, { pesanError } from '../lib/api';
import type { Rapor } from '../types';

// Grafik garis perkembangan nilai dengan garis putus-putus KKM. SVG murni agar ringan dan bisa dicetak.
function Grafik({ nilai, kkm }: { nilai: Rapor['nilai']; kkm: number }) {
  const L = 560;
  const T = 220;
  const pad = { k: 36, a: 12, ka: 14, b: 28 };
  const lebar = L - pad.k - pad.ka;
  const tinggi = T - pad.a - pad.b;
  const x = (i: number) => pad.k + (nilai.length === 1 ? lebar / 2 : (i / (nilai.length - 1)) * lebar);
  const y = (v: number) => pad.a + tinggi - (v / 100) * tinggi;
  const titik = nilai.map((n, i) => `${x(i)},${y(n.nilai)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${L} ${T}`}
      role="img"
      aria-label={`Grafik perkembangan nilai: ${nilai.map((n) => n.nilai).join(', ')}. KKM ${kkm}.`}
      className="h-auto w-full"
    >
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad.k} x2={L - pad.ka} y1={y(v)} y2={y(v)} stroke="#E6E6F1" strokeWidth="1" />
          <text x={pad.k - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6F6F89">
            {v}
          </text>
        </g>
      ))}
      <line x1={pad.k} x2={L - pad.ka} y1={y(kkm)} y2={y(kkm)} stroke="#E5A21F" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={L - pad.ka} y={y(kkm) - 5} textAnchor="end" fontSize="11" fill="#9A6A0B">
        KKM {kkm}
      </text>
      {nilai.length > 1 && <polyline points={titik} fill="none" stroke="#5350F7" strokeWidth="2" />}
      {nilai.map((n, i) => (
        <g key={n.id}>
          <circle cx={x(i)} cy={y(n.nilai)} r="4.5" fill={n.nilai >= kkm ? '#5350F7' : '#DC2626'} />
          <text x={x(i)} y={y(n.nilai) - 9} textAnchor="middle" fontSize="11" fill="#0F0F24">
            {angka(n.nilai, 0)}
          </text>
        </g>
      ))}
      <text x={pad.k} y={T - 8} fontSize="11" fill="#6F6F89">
        {tanggal(nilai[0].tanggal)}
      </text>
      {nilai.length > 1 && (
        <text x={L - pad.ka} y={T - 8} textAnchor="end" fontSize="11" fill="#6F6F89">
          {tanggal(nilai[nilai.length - 1].tanggal)}
        </text>
      )}
    </svg>
  );
}

export default function RaporSiswa() {
  const { id, siswaId } = useParams();
  const [r, setR] = useState<Rapor | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    api
      .get(`/kelas/siswa/${siswaId}/rapor`)
      .then((res) => setR(res.data))
      .catch((e) => setGalat(pesanError(e, 'Rapor tidak ditemukan.')));
  }, [siswaId]);

  if (!r) return galat ? <Pesan nada="galat">{galat}</Pesan> : <Memuat />;

  const selisih = r.rataRata !== null && r.rataKelas !== null ? r.rataRata - r.rataKelas : null;
  const lemah = r.perMapel.filter((m) => m.rataRata !== null && m.rataRata < r.kelas.kkm);

  return (
    <div>
      <Header
        judul={`Rapor ${r.siswa.nama}`}
        deskripsi={`NIS ${r.siswa.nis} · Kelas ${r.kelas.nama} · ${r.kelas.tapel}`}
        aksi={
          <>
            <button type="button" onClick={() => window.print()} className="btn-utama">
              Cetak / PDF
            </button>
            <Link to={`/kelas/${id}`} className="btn-garis">
              Kembali ke kelas
            </Link>
          </>
        }
      />

      {r.nilai.length === 0 ? (
        <Pesan>Belum ada nilai untuk siswa ini.</Pesan>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="kartu">
              <p className="font-display text-2xl font-semibold text-tinta-700">{angka(r.rataRata)}</p>
              <p className="mt-1 text-sm text-tinta-500">Rata-rata nilai</p>
            </div>
            <div className="kartu">
              <p className="font-display text-2xl font-semibold text-tinta-700">{angka(r.rataKelas)}</p>
              <p className="mt-1 text-sm text-tinta-500">Rata-rata kelas</p>
            </div>
            <div className="kartu">
              <p className="font-display text-2xl font-semibold text-tinta-700">{r.kelas.kkm}</p>
              <p className="mt-1 text-sm text-tinta-500">KKM</p>
            </div>
            <div className="kartu">
              {r.tuntas ? (
                <span className="lencana bg-emerald-50 text-base text-emerald-800">Tuntas</span>
              ) : (
                <span className="lencana bg-red-50 text-base text-red-800">Perlu remedial</span>
              )}
              <p className="mt-2 text-sm text-tinta-500">Status terhadap KKM</p>
            </div>
          </div>

          <div className="kartu">
            <h2 className="mb-2 text-lg font-semibold">Perkembangan nilai</h2>
            <Grafik nilai={r.nilai} kkm={r.kelas.kkm} />
            <p className="mt-2 text-xs text-tinta-500">Titik merah berarti nilai di bawah KKM.</p>
          </div>

          <div className="kartu">
            <h2 className="mb-2 text-lg font-semibold">Catatan</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-tinta-700">
              {selisih !== null && (
                <li>
                  Rata-rata {selisih >= 0 ? `${angka(Math.abs(selisih))} poin di atas` : `${angka(Math.abs(selisih))} poin di bawah`} rata-rata kelas.
                </li>
              )}
              {lemah.length > 0 ? (
                <li>
                  Mata pelajaran di bawah KKM: <b>{lemah.map((m) => m.mapel).join(', ')}</b>. Perlu pendampingan atau remedial.
                </li>
              ) : (
                <li>Seluruh mata pelajaran berada di atas KKM.</li>
              )}
            </ul>
          </div>

          <div className="kartu overflow-x-auto p-0">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-tinta-100 bg-tinta-50 text-left text-xs text-tinta-500">
                  <th className="px-3 py-2">Penilaian</th>
                  <th className="px-3 py-2">Mata pelajaran</th>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {r.nilai.map((n) => (
                  <tr key={n.id} className="border-b border-tinta-50">
                    <td className="px-3 py-2">
                      {n.jenis}
                      {n.judul ? `: ${n.judul}` : ''}
                    </td>
                    <td className="px-3 py-2">{n.mapel}</td>
                    <td className="px-3 py-2">{tanggal(n.tanggal)}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${n.nilai < r.kelas.kkm ? 'text-red-700' : ''}`}>{angka(n.nilai)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
