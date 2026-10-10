import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Kosong, Memuat, Pesan, SelectPil } from '../components/ui';
import api, { pesanError, unduh } from '../lib/api';
import { useAuth } from '../lib/auth';
import { bacaBerkasSiswa, unduhTemplatSiswa, type SiswaBaru } from '../lib/berkasSiswa';
import type { JenisNilai, Rekap, Siswa } from '../types';

type Tab = 'rekap' | 'nilai' | 'siswa';

const JENIS: JenisNilai[] = ['Tugas', 'UH', 'UTS', 'UAS'];

// Satu desimal gaya Indonesia (100,0), seperti di desain.
const satuDesimal = (n: number | null | undefined): string =>
  n === null || n === undefined ? '–' : n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Nama kolom rekap berbentuk "UH: Bab 3 (Matematika)"; mata pelajaran ada di dalam kurung terakhir.
const mapelDariKolom = (kolom: string): string => /\(([^()]*)\)$/.exec(kolom)?.[1] ?? '';

// Satu baris per siswa: "Nama, NIS" (hasil tempel dari spreadsheet juga bisa dipisah tab atau titik koma).
function parseSiswa(teks: string): { nama: string; nis: string }[] {
  return teks
    .split('\n')
    .map((b) => b.split(/[,;\t]/).map((s) => s.trim()))
    .filter((p) => p.length >= 2 && p[0] && p[1])
    .map(([nama, nis]) => ({ nama, nis }));
}

const KARTU_TABEL = 'kartu shadow-kartu px-4 py-5 sm:px-5';
const KEPALA_TABEL = 'border-b border-[#E6E6E6] text-left text-sm font-semibold text-ajarin-700';
const BARIS_TABEL = 'border-b border-[#E6E6E6] last:border-0';

function TabSiswa({ kelasId, siswa, muat }: { kelasId: string; siswa: Siswa[]; muat: () => Promise<void> }) {
  const [teks, setTeks] = useState('');
  const [nama, setNama] = useState('');
  const [nis, setNis] = useState('');
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [berkas, setBerkas] = useState<{ nama: string; siswa: SiswaBaru[]; dilewati: number } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const inputBerkas = useRef<HTMLInputElement>(null);
  // Berkas yang sudah dibaca menggantikan isian teks.
  const baris = berkas ? berkas.siswa : parseSiswa(teks);

  async function pilihBerkas(f: File | undefined) {
    if (!f) return;
    setGalat('');
    setInfo('');
    try {
      setBerkas({ nama: f.name, ...(await bacaBerkasSiswa(f)) });
    } catch (e) {
      setBerkas(null);
      setGalat(pesanError(e, 'Gagal membaca berkas.'));
    } finally {
      if (inputBerkas.current) inputBerkas.current.value = '';
    }
  }

  async function kirimSiswa(daftar: { nama: string; nis: string }[]) {
    // Server menerima maksimal 200 siswa per permintaan.
    let ditambahkan = 0;
    let dilewati = 0;
    for (let i = 0; i < daftar.length; i += 200) {
      const r = await api.post(`/kelas/${kelasId}/siswa`, { siswa: daftar.slice(i, i + 200) });
      ditambahkan += r.data.ditambahkan;
      dilewati += r.data.dilewati;
    }
    setInfo(`${ditambahkan} siswa ditambahkan${dilewati ? `, ${dilewati} dilewati karena NIS sudah ada` : ''}.`);
    await muat();
  }

  async function tambahBanyak() {
    setSibuk(true);
    setGalat('');
    setInfo('');
    try {
      await kirimSiswa(baris);
      setTeks('');
      setBerkas(null);
    } catch (e) {
      setGalat(pesanError(e, 'Gagal menambah siswa.'));
    } finally {
      setSibuk(false);
    }
  }

  async function tambahSatu(e: FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat('');
    setInfo('');
    try {
      await kirimSiswa([{ nama: nama.trim(), nis: nis.trim() }]);
      setNama('');
      setNis('');
    } catch (err) {
      setGalat(pesanError(err, 'Gagal menambah siswa.'));
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(s: Siswa) {
    if (!window.confirm(`Hapus ${s.nama} beserta seluruh nilainya?`)) return;
    try {
      await api.delete(`/kelas/siswa/${s.id}`);
      await muat();
    } catch (e) {
      setGalat(pesanError(e));
    }
  }

  return (
    <div className="space-y-2.5">
      <section className="rounded-[14px] border border-[#E6E6E6] px-5 py-4" aria-labelledby="judul-sekaligus">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="judul-sekaligus" className="text-xl font-bold text-hijau">
              Tambah siswa sekaligus
            </h2>
            <p className="mt-1 text-xs text-tinta-400">Unggah daftar dari Excel atau CSV, atau tempel dari spreadsheet. Kolom: Nama dan NIS.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={unduhTemplatSiswa} className="text-sm font-semibold text-hijau hover:underline">
              Unduh Template Excel
            </button>
            <input
              ref={inputBerkas}
              id="berkas-siswa"
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              className="peer sr-only"
              onChange={(e) => void pilihBerkas(e.target.files?.[0])}
            />
            <label
              htmlFor="berkas-siswa"
              className="btn cursor-pointer bg-hijau py-3 text-white hover:opacity-90 peer-focus-visible:ring-2 peer-focus-visible:ring-hijau peer-focus-visible:ring-offset-2"
            >
              Unggah Excel/CSV
            </label>
          </div>
        </div>

        {berkas ? (
          <div className="mt-4 rounded-[7px] border border-[#E6E6E6] bg-tinta-50 p-3 text-sm">
            <p className="font-medium">
              {berkas.nama}: {berkas.siswa.length} siswa terbaca
              {berkas.dilewati > 0 && <span className="font-normal text-tinta-500"> ({berkas.dilewati} baris dilewati karena nama atau NIS kosong)</span>}
            </p>
            <ul className="mt-2 space-y-0.5 text-tinta-400">
              {berkas.siswa.slice(0, 5).map((s, i) => (
                <li key={i} className="truncate">
                  {s.nama} <span className="text-tinta-500">· {s.nis}</span>
                </li>
              ))}
            </ul>
            {berkas.siswa.length > 5 && <p className="mt-1 text-xs text-tinta-500">dan {berkas.siswa.length - 5} siswa lainnya</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={tambahBanyak} disabled={sibuk || baris.length === 0} className="btn bg-hijau py-2 text-white hover:opacity-90">
                {sibuk ? 'Menambahkan...' : `Tambah ${baris.length} siswa`}
              </button>
              <button type="button" onClick={() => setBerkas(null)} className="btn-bahaya py-2">
                Batalkan berkas
              </button>
            </div>
          </div>
        ) : (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-hijau">Atau tempel dari spreadsheet</summary>
            <div className="mt-2 space-y-2">
              <label htmlFor="tempel" className="sr-only">
                Tempel daftar siswa, satu baris per siswa: Nama, NIS
              </label>
              <textarea
                id="tempel"
                rows={6}
                className="input font-mono text-xs"
                placeholder={'Ahmad Fauzan, 2026001\nBunga Citra, 2026002'}
                value={teks}
                onChange={(e) => setTeks(e.target.value)}
              />
              <p className="text-xs text-tinta-500">Satu baris per siswa (Nama, NIS). Bisa ditempel langsung dari dua kolom spreadsheet. NIS yang sudah ada dilewati.</p>
              <button type="button" onClick={tambahBanyak} disabled={baris.length === 0 || sibuk} className="btn bg-hijau py-2 text-white hover:opacity-90">
                {sibuk ? 'Menambahkan...' : `Tambah ${baris.length || ''} siswa`}
              </button>
            </div>
          </details>
        )}
      </section>

      <section className={KARTU_TABEL} aria-labelledby="judul-daftar-siswa">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 id="judul-daftar-siswa" className="text-xl font-bold text-ajarin-700">
            Daftar Siswa
          </h2>
          <form onSubmit={tambahSatu} className="flex flex-col gap-[7px] sm:flex-row">
            <input aria-label="Nama siswa" required minLength={2} placeholder="Tambah Nama Siswa..." className="input-pil sm:w-60" value={nama} onChange={(e) => setNama(e.target.value)} />
            <input aria-label="NIS" required placeholder="Masukkan NIS.." className="input-pil sm:w-44" value={nis} onChange={(e) => setNis(e.target.value)} />
            <button type="submit" disabled={sibuk} className="btn-utama py-3">
              Tambah Siswa
            </button>
          </form>
        </div>
        {(galat || info) && (
          <div className="mt-3 space-y-2">
            {galat && <Pesan nada="galat">{galat}</Pesan>}
            {info && <Pesan nada="sukses">{info}</Pesan>}
          </div>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className={KEPALA_TABEL}>
                <th className="w-16 px-3 py-3.5">No</th>
                <th className="px-3 py-3.5">Nama Siswa</th>
                <th className="px-3 py-3.5 text-center">NIS</th>
                <th className="px-3 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-tinta-400">
              {siswa.map((s, i) => (
                <tr key={s.id} className={BARIS_TABEL}>
                  <td className="px-3 py-3">{i + 1}</td>
                  <td className="px-3 py-3">{s.nama}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{s.nis}</td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => hapus(s)} className="font-semibold text-merah hover:underline">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {siswa.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-tinta-500">
                    Belum ada siswa. Tambahkan lewat kolom di atas atau unggah berkas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TabNilai({ kelasId, siswa, muat, mapelOpsi }: { kelasId: string; siswa: Siswa[]; muat: () => Promise<void>; mapelOpsi: string[] }) {
  const [jenis, setJenis] = useState<JenisNilai | ''>('');
  const [mapel, setMapel] = useState('');
  const [judul, setJudul] = useState('');
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const terisi = siswa.filter((s) => nilai[s.id] !== undefined && nilai[s.id] !== '');
  const tidakValid = terisi.some((s) => !(Number(nilai[s.id]) >= 0 && Number(nilai[s.id]) <= 100));

  async function simpan() {
    if (!jenis) return;
    setSibuk(true);
    setGalat('');
    setInfo('');
    try {
      const r = await api.post(`/kelas/${kelasId}/nilai`, {
        jenis,
        mapel: mapel.trim(),
        judul: judul.trim(),
        items: terisi.map((s) => ({ siswaId: s.id, nilai: Number(nilai[s.id]) })),
      });
      setInfo(`${r.data.dibuat} nilai baru, ${r.data.diperbarui} diperbarui.`);
      setNilai({});
      await muat();
    } catch (e) {
      setGalat(pesanError(e, 'Gagal menyimpan nilai.'));
    } finally {
      setSibuk(false);
    }
  }

  if (siswa.length === 0) return <Kosong judul="Belum ada siswa" isi="Tambahkan siswa di tab Siswa sebelum mencatat nilai." />;

  return (
    <section className={KARTU_TABEL} aria-labelledby="judul-input-nilai">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <h2 id="judul-input-nilai" className="text-xl font-bold text-ajarin-700">
          Daftar Input Nilai
        </h2>
        <div className="flex flex-col gap-[7px] sm:flex-row sm:flex-wrap sm:items-center">
          <div className="sm:w-56">
            <input
              aria-label="Mata pelajaran"
              list="opsi-mapel"
              placeholder="Tulis Mata Pelajaran"
              className="input-pil"
              value={mapel}
              onChange={(e) => setMapel(e.target.value)}
            />
            <datalist id="opsi-mapel">
              {mapelOpsi.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <SelectPil aria-label="Jenis penilaian" className="sm:w-48" value={jenis} onChange={(e) => setJenis(e.target.value as JenisNilai)}>
            <option value="" disabled>
              Jenis Penilaian
            </option>
            {JENIS.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </SelectPil>
          <input aria-label="Judul penilaian (opsional)" placeholder="Judul, mis. Bab 3 (opsional)" className="input-pil sm:w-56" value={judul} onChange={(e) => setJudul(e.target.value)} />
          <button type="button" onClick={simpan} disabled={sibuk || terisi.length === 0 || tidakValid || !mapel.trim() || !jenis} className="btn-utama py-3">
            {sibuk ? 'Menyimpan...' : `Simpan ${terisi.length} Nilai`}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-tinta-500">Nilai dengan mata pelajaran, jenis, dan judul yang sama memperbarui nilai lama siswa, bukan menambah baris baru.</p>
      {(tidakValid || galat || info) && (
        <div className="mt-3 space-y-2">
          {tidakValid && <Pesan nada="awas">Nilai harus berada di antara 0 dan 100.</Pesan>}
          {galat && <Pesan nada="galat">{galat}</Pesan>}
          {info && <Pesan nada="sukses">{info}</Pesan>}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={KEPALA_TABEL}>
              <th className="w-10 px-2 py-3.5 text-center sm:w-16 sm:px-3">No</th>
              <th className="px-2 py-3.5 sm:px-3">Nama Siswa</th>
              <th className="hidden px-3 py-3.5 text-center sm:table-cell">NIS</th>
              <th className="w-28 px-2 py-3.5 text-center sm:w-36 sm:px-3">Nilai</th>
            </tr>
          </thead>
          <tbody className="text-sm font-medium text-tinta-400">
            {siswa.map((s, i) => (
              <tr key={s.id} className={BARIS_TABEL}>
                <td className="px-2 py-2 text-center sm:px-3">{i + 1}</td>
                <td className="px-2 py-2 sm:px-3">
                  <label htmlFor={`n-${s.id}`}>{s.nama}</label>
                  <span className="block text-xs tabular-nums text-tinta-300 sm:hidden">{s.nis}</span>
                </td>
                <td className="hidden px-3 py-2 text-center tabular-nums sm:table-cell">{s.nis}</td>
                <td className="px-3 py-1.5">
                  <input
                    id={`n-${s.id}`}
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    placeholder="Input Nilai"
                    className="mx-auto block w-full max-w-[6rem] rounded-[7px] border border-[#CCCCCC] px-2 py-1.5 text-center text-xs text-tinta-900 placeholder:text-[#CCCCCC] focus:border-ajarin-500 focus:outline-none focus:ring-2 focus:ring-ajarin-500/20"
                    value={nilai[s.id] ?? ''}
                    onChange={(e) => setNilai({ ...nilai, [s.id]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TabRekap({ rekap, kelasId }: { rekap: Rekap; kelasId: string }) {
  const [galat, setGalat] = useState('');
  const [mapel, setMapel] = useState('');
  const [kkmTeks, setKkmTeks] = useState('');

  const daftarMapel = useMemo(() => [...new Set(rekap.kolom.map(mapelDariKolom).filter(Boolean))], [rekap.kolom]);
  const kolom = useMemo(() => (mapel ? rekap.kolom.filter((k) => mapelDariKolom(k) === mapel) : rekap.kolom), [rekap.kolom, mapel]);
  // KKM yang diketik hanya mengubah tampilan status di halaman ini; KKM kelas yang tersimpan tidak berubah.
  const kkm = kkmTeks !== '' && Number(kkmTeks) >= 0 && Number(kkmTeks) <= 100 ? Number(kkmTeks) : rekap.kelas.kkm;

  const baris = useMemo(
    () =>
      rekap.baris.map((b) => {
        const nilai = kolom.map((k) => b.nilai[k]).filter((n): n is number => n !== null && n !== undefined);
        const rataRata = nilai.length ? nilai.reduce((t, n) => t + n, 0) / nilai.length : null;
        return { ...b, rataRata, tuntas: rataRata === null ? null : rataRata >= kkm };
      }),
    [rekap.baris, kolom, kkm]
  );

  const berNilai = baris.filter((b) => b.rataRata !== null).map((b) => b.rataRata as number);
  const rataKelas = berNilai.length ? berNilai.reduce((t, n) => t + n, 0) / berNilai.length : null;
  const tertinggi = berNilai.length ? Math.max(...berNilai) : null;
  const terendah = berNilai.length ? Math.min(...berNilai) : null;
  const belumTuntas = baris.filter((b) => b.tuntas === false).length;

  async function ekspor() {
    try {
      await unduh(`/kelas/${kelasId}/rekap/ekspor`, undefined, 'rekap.xlsx');
    } catch (e) {
      setGalat(pesanError(e, 'Gagal mengunduh.'));
    }
  }

  if (rekap.kolom.length === 0) {
    return <Kosong judul="Belum ada nilai" isi="Catat nilai di tab Input Nilai, atau impor dari hasil kuis Google Form di menu Bank Soal." />;
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-[7px] lg:grid-cols-4">
        {[
          ['Jumlah Siswa', String(rekap.ringkasan.jumlahSiswa), 'text-ajarin-600'],
          ['Rata-Rata Kelas', satuDesimal(rataKelas), 'text-ajarin-500'],
          ['Tertinggi/Terendah', `${satuDesimal(tertinggi)}/${satuDesimal(terendah)}`, 'text-ajarin-500'],
          [`Belum Tuntas (<${kkm})`, String(belumTuntas), 'text-ajarin-500'],
        ].map(([label, nilai, warna]) => (
          <div key={label} className="flex min-h-[97px] flex-col justify-end rounded-[14px] border border-ajarin-50 bg-white px-3.5 py-3">
            <p className="text-sm font-medium text-ajarin-200">{label}</p>
            <p className={`mt-1 break-words text-2xl font-bold sm:text-[32px] sm:leading-tight ${warna}`}>{nilai}</p>
          </div>
        ))}
      </div>

      <section className={KARTU_TABEL} aria-labelledby="judul-rekap">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 id="judul-rekap" className="text-xl font-bold text-ajarin-700">
            Daftar Nama
          </h2>
          <div className="flex flex-col gap-[7px] sm:flex-row sm:flex-wrap sm:items-center">
            <SelectPil aria-label="Pilih mata pelajaran" className="sm:w-60" value={mapel} onChange={(e) => setMapel(e.target.value)}>
              <option value="">Semua Mata Pelajaran</option>
              {daftarMapel.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </SelectPil>
            <input
              aria-label="KKM"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              placeholder={`Masukkan KKM... (${rekap.kelas.kkm})`}
              className="input-pil sm:w-52"
              value={kkmTeks}
              onChange={(e) => setKkmTeks(e.target.value)}
            />
            <button type="button" onClick={ekspor} className="btn-garis py-2.5">
              Unduh Excel
            </button>
          </div>
        </div>
        {galat && (
          <div className="mt-3">
            <Pesan nada="galat">{galat}</Pesan>
          </div>
        )}
        <p className="mt-2 text-xs text-tinta-500">Klik nama siswa untuk melihat rapor singkatnya.</p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className={KEPALA_TABEL}>
                <th className="w-14 px-3 py-3.5">No</th>
                <th className="px-3 py-3.5">Nama Siswa</th>
                {kolom.map((k) => (
                  <th key={k} className="px-3 py-3.5 text-center">
                    {k}
                  </th>
                ))}
                <th className="px-3 py-3.5 text-center">Rata-Rata</th>
                <th className="px-3 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-tinta-400">
              {baris.map((b, i) => (
                <tr key={b.siswaId} className={BARIS_TABEL}>
                  <td className="px-3 py-3">{i + 1}</td>
                  <td className="px-3 py-3">
                    <Link to={`/kelas/${kelasId}/siswa/${b.siswaId}`} className="hover:text-ajarin-500 hover:underline">
                      {b.nama}
                    </Link>
                  </td>
                  {kolom.map((k) => (
                    <td key={k} className="px-3 py-3 text-center tabular-nums">
                      {b.nilai[k] === null || b.nilai[k] === undefined ? '-' : satuDesimal(b.nilai[k])}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center tabular-nums">{satuDesimal(b.rataRata)}</td>
                  <td className="px-3 py-3 text-center">
                    {b.tuntas === null ? (
                      <span>Belum Dinilai</span>
                    ) : b.tuntas ? (
                      <span className="inline-flex rounded-[21px] bg-ajarin-500 px-2.5 py-1.5 text-xs font-normal text-white">Tuntas</span>
                    ) : (
                      <span className="inline-flex rounded-[21px] bg-merah px-2.5 py-1.5 text-xs font-normal text-white">Remedial</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function KelasDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('rekap');
  const [rekap, setRekap] = useState<Rekap | null>(null);
  const [siswa, setSiswa] = useState<Siswa[]>([]);
  const [galat, setGalat] = useState('');

  const muat = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([api.get(`/kelas/${id}/rekap`), api.get(`/kelas/${id}`)]);
      setRekap(r.data);
      setSiswa(s.data.siswa);
    } catch (e) {
      setGalat(pesanError(e, 'Kelas tidak ditemukan.'));
    }
  }, [id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const mapelOpsi = useMemo(() => {
    const dariNilai = (rekap?.kolom ?? []).map(mapelDariKolom).filter(Boolean);
    return [...new Set([user?.mapel ?? '', ...dariNilai].filter(Boolean))];
  }, [rekap?.kolom, user?.mapel]);

  if (!rekap) return galat ? <Pesan nada="galat">{galat}</Pesan> : <Memuat />;

  const TAB: [Tab, string][] = [
    ['rekap', 'Rekap Nilai'],
    ['nilai', 'Input Nilai'],
    ['siswa', 'Siswa'],
  ];

  return (
    <div className="space-y-2.5">
      <section className="flex flex-col gap-2 rounded-[21px] border border-[#E6E6E6] py-2 pl-5 pr-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 py-1 sm:py-0">
          <h1 className="truncate text-xl font-bold">Kelas {rekap.kelas.nama}</h1>
          <p className="text-xs text-tinta-500">
            {rekap.kelas.tapel} · KKM {rekap.kelas.kkm}
          </p>
        </div>
        <div role="tablist" aria-label="Bagian kelas" className="flex rounded-[21px] bg-ajarin-50">
          {TAB.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 whitespace-nowrap rounded-[21px] px-3 py-3.5 text-sm font-semibold transition-colors sm:flex-none sm:px-5 ${
                tab === k ? 'bg-ajarin-500 text-[#FEFEFE] shadow-[0_4px_10px_rgba(219,208,208,0.32)]' : 'text-ajarin-500 hover:bg-ajarin-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {galat && <Pesan nada="galat">{galat}</Pesan>}

      {tab === 'rekap' && <TabRekap rekap={rekap} kelasId={rekap.kelas.id} />}
      {tab === 'nilai' && <TabNilai kelasId={rekap.kelas.id} siswa={siswa} muat={muat} mapelOpsi={mapelOpsi} />}
      {tab === 'siswa' && <TabSiswa kelasId={rekap.kelas.id} siswa={siswa} muat={muat} />}
    </div>
  );
}
