import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header, Kosong, Memuat, Pesan, angka } from '../components/ui';
import api, { pesanError } from '../lib/api';
import type { Dampak as DataDampak, StatusMateri, TitikTren } from '../types';

// Status selalu disertai label teks, jadi tidak bergantung pada warna saja.
const WARNA_STATUS: Record<StatusMateri, { bar: string; lencana: string; label: string }> = {
  lemah: { bar: 'bg-red-500', lencana: 'bg-red-50 text-red-800', label: 'Perlu diulang' },
  cukup: { bar: 'bg-amber-500', lencana: 'bg-pelita-50 text-pelita-700', label: 'Cukup' },
  kuat: { bar: 'bg-emerald-600', lencana: 'bg-emerald-50 text-emerald-800', label: 'Dikuasai' },
};

const pendekkan = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Garis rata-rata kelas per penilaian, dengan garis putus-putus KKM. SVG murni agar ringan dan bisa dicetak.
function GrafikTren({ titik, kkm, nama }: { titik: TitikTren[]; kkm: number; nama: string }) {
  const L = 560;
  const T = 230;
  const pad = { k: 36, a: 14, ka: 18, b: 44 };
  const lebar = L - pad.k - pad.ka;
  const tinggi = T - pad.a - pad.b;
  const x = (i: number) => pad.k + (titik.length === 1 ? lebar / 2 : (i / (titik.length - 1)) * lebar);
  const y = (v: number) => pad.a + tinggi - (v / 100) * tinggi;
  const semuaLabel = titik.length <= 5;

  return (
    <svg
      viewBox={`0 0 ${L} ${T}`}
      role="img"
      aria-label={`Tren rata-rata kelas ${nama}: ${titik.map((t) => `${t.label} ${angka(t.rata)}`).join(', ')}. KKM ${kkm}.`}
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
      {titik.length > 1 && (
        <polyline points={titik.map((t, i) => `${x(i)},${y(t.rata)}`).join(' ')} fill="none" stroke="#5350F7" strokeWidth="2" />
      )}
      {titik.map((t, i) => {
        const awal = i === 0 && titik.length > 1;
        const akhir = i === titik.length - 1 && titik.length > 1;
        return (
          <g key={`${t.label}-${i}`}>
            <circle cx={x(i)} cy={y(t.rata)} r="5" fill={t.rata >= kkm ? '#5350F7' : '#DC2626'} stroke="#fff" strokeWidth="2">
              <title>{`${t.label}: rata-rata ${angka(t.rata)} (${t.jumlah} siswa)`}</title>
            </circle>
            <text x={x(i)} y={y(t.rata) - 10} textAnchor="middle" fontSize="11" fill="#0F0F24">
              {angka(t.rata)}
            </text>
            {(semuaLabel || awal || akhir) && (
              <text x={x(i)} y={T - 22} textAnchor={awal ? 'start' : akhir ? 'end' : 'middle'} fontSize="10.5" fill="#5A6B94">
                {pendekkan(t.label, semuaLabel ? 18 : 24)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Batang({ label, nilai, warna }: { label: string; nilai: number; warna: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-16 shrink-0 text-tinta-500">{label}</span>
      <span className="h-3 flex-1 overflow-hidden rounded-full bg-tinta-50">
        <span className={`block h-full rounded-full ${warna}`} style={{ width: `${Math.min(100, Math.max(0, nilai))}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{angka(nilai)}</span>
    </div>
  );
}

function Bagian({ judul, catatan, children, lebar = false }: { judul: string; catatan?: string; children: ReactNode; lebar?: boolean }) {
  return (
    <section className={`kartu break-inside-avoid ${lebar ? 'xl:col-span-2' : ''}`}>
      <h2 className="text-lg font-bold">{judul}</h2>
      {catatan ? <p className="mb-3 mt-0.5 text-sm text-tinta-500">{catatan}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

export default function Dampak() {
  const [d, setD] = useState<DataDampak | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    api
      .get('/dampak')
      .then((r) => setD(r.data))
      .catch((e) => setGalat(pesanError(e, 'Gagal memuat data dampak.')));
  }, []);

  if (!d) return galat ? <Pesan nada="galat">{galat}</Pesan> : <Memuat />;

  const { ringkasan: r, remedial } = d;
  const t = remedial.total;
  const selisih = t.sebelum !== null && t.sesudah !== null ? t.sesudah - t.sebelum : null;

  return (
    <div>
      <Header
        judul="Dampak & Peta Belajar"
        deskripsi="Bukti perkembangan belajar siswa dari nilai dan hasil kuis yang sudah Anda catat."
        aksi={
          <button type="button" onClick={() => window.print()} className="btn-garis">
            Cetak / PDF
          </button>
        }
      />

      {r.siswaBerNilai === 0 ? (
        <Kosong
          judul="Belum ada nilai untuk dianalisis"
          isi="Catat nilai di menu Kelas & Nilai, atau impor hasil kuis Google Form dari Bank Soal. Halaman ini terisi otomatis setelah itu."
          aksi={
            <Link to="/kelas" className="btn-utama">
              Buka Kelas & Nilai
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:col-span-2">
            {[
              ['Rata-rata nilai', angka(r.rataRata), `${r.siswaBerNilai} siswa bernilai`],
              ['Siswa tuntas', r.persenTuntas === null ? '–' : `${r.persenTuntas}%`, 'rata-rata ≥ KKM'],
              ['Perlu perhatian', `${d.perhatian.length}`, 'siswa'],
              ['Naik setelah remedial', t.jumlahSiswa ? `${t.naik}/${t.jumlahSiswa}` : '–', 'siswa'],
            ].map(([label, nilai, ket]) => (
              <div key={label} className="kartu">
                <p className="text-3xl font-bold text-ajarin-500">{nilai}</p>
                <p className="mt-1 text-sm text-tinta-700">{label}</p>
                <p className="text-xs text-tinta-500">{ket}</p>
              </div>
            ))}
          </div>

          <Bagian judul="Dampak remedial" catatan="Nilai siswa yang mengikuti remedial, dibandingkan antara sebelum dan sesudah.">
            {remedial.sets.length === 0 ? (
              <p className="text-sm text-tinta-500">
                Belum ada hasil remedial. Alurnya: impor hasil kuis di Bank Soal, buat soal remedial dari analisis, bagikan lewat Google
                Form, lalu impor nilainya.
              </p>
            ) : (
              <div className="space-y-5">
                <p className="text-tinta-900">
                  Dari <b>{t.jumlahSiswa} siswa</b> yang mengikuti remedial, <b>{t.naik} siswa nilainya naik</b>
                  {t.tuntasBaru > 0 && (
                    <>
                      , dan <b>{t.tuntasBaru} siswa</b> kini mencapai KKM
                    </>
                  )}
                  . Rata-rata berubah dari <b>{angka(t.sebelum)}</b> menjadi <b>{angka(t.sesudah)}</b>
                  {selisih !== null && (
                    <>
                      {' '}
                      ({selisih >= 0 ? '+' : '−'}
                      {angka(Math.abs(selisih))} poin)
                    </>
                  )}
                  .
                </p>
                {remedial.sets.map((s) => (
                  <div key={s.setId} className="space-y-1.5">
                    <p className="text-sm font-medium">
                      <Link to={`/soal/${s.setId}`} className="underline decoration-tinta-100 underline-offset-2 hover:decoration-ajarin-500">
                        {s.sumberJudul}
                      </Link>{' '}
                      <span className="font-normal text-tinta-500">· {s.jumlahSiswa} siswa</span>
                    </p>
                    <Batang label="Sebelum" nilai={s.sebelum} warna="bg-tinta-300" />
                    <Batang label="Sesudah" nilai={s.sesudah} warna="bg-tinta-700" />
                  </div>
                ))}
              </div>
            )}
          </Bagian>

          <Bagian judul="Peta materi" catatan="Rata-rata persentase siswa yang menjawab benar per materi, dari hasil kuis yang sudah diimpor.">
            {d.materi.length === 0 ? (
              <p className="text-sm text-tinta-500">
                Belum ada analisis soal. Impor hasil kuis Google Form di halaman set soal, dan peta materi akan muncul di sini.
              </p>
            ) : (
              <ul className="space-y-3">
                {d.materi.map((m) => {
                  const w = WARNA_STATUS[m.status];
                  return (
                    <li key={m.materi}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{m.materi}</span>
                        <span className="flex items-center gap-2">
                          <span className={`lencana ${w.lencana}`}>{w.label}</span>
                          <span className="font-semibold tabular-nums">{m.persenBenar}%</span>
                        </span>
                      </div>
                      <div
                        className="h-2.5 overflow-hidden rounded-full bg-tinta-50"
                        role="img"
                        aria-label={`${m.materi}: ${m.persenBenar}% benar dari ${m.jumlahSoal} soal. ${w.label}.`}
                      >
                        <div className={`h-full rounded-full ${w.bar}`} style={{ width: `${m.persenBenar}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Bagian>

          <Bagian lebar judul="Tren nilai kelas" catatan="Rata-rata kelas pada setiap penilaian. Titik merah berarti di bawah KKM.">
            <div className="grid gap-6 lg:grid-cols-2">
              {d.tren
                .filter((k) => k.titik.length > 0)
                .map((k) => (
                  <div key={k.kelasId}>
                    <p className="mb-1 text-sm font-medium">
                      Kelas {k.nama} <span className="font-normal text-tinta-500">· {k.titik.length} penilaian</span>
                    </p>
                    <GrafikTren titik={k.titik} kkm={k.kkm} nama={k.nama} />
                  </div>
                ))}
              {d.tren.every((k) => k.titik.length === 0) && <p className="text-sm text-tinta-500">Belum ada penilaian.</p>}
            </div>
          </Bagian>

          <Bagian lebar judul="Siswa yang perlu perhatian" catatan="Rata-rata di bawah KKM, nilai turun tajam, atau belum tuntas setelah remedial.">
            {d.perhatian.length === 0 ? (
              <p className="text-sm text-tinta-500">Tidak ada siswa yang perlu perhatian khusus saat ini.</p>
            ) : (
              <ul className="divide-y divide-tinta-50">
                {d.perhatian.map((p) => (
                  <li key={p.siswaId} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                    <div>
                      <Link
                        to={`/kelas/${p.kelasId}/siswa/${p.siswaId}`}
                        className="font-medium underline decoration-tinta-100 underline-offset-2 hover:decoration-ajarin-500"
                      >
                        {p.nama}
                      </Link>{' '}
                      <span className="text-tinta-300">· kelas {p.kelasNama}</span>
                      <ul className="mt-0.5 list-disc pl-5 text-tinta-700">
                        {p.alasan.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <span className="lencana bg-tinta-50 text-tinta-700">rata-rata {angka(p.rataRata)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Bagian>
        </div>
      )}
    </div>
  );
}
