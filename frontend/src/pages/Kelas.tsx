import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import ImporSiswa from '../components/ImporSiswa';
import { Kelas as KelasType, Nilai } from '../types';

const JENIS_LIST = [
  { kode: 'Tugas', label: 'Tugas' },
  { kode: 'UH', label: 'Ulangan harian' },
  { kode: 'UTS', label: 'UTS' },
  { kode: 'UAS', label: 'UAS' },
];

interface RekapRow {
  siswaId: string;
  nama: string;
  nis: string;
  jumlahNilai: number;
  rataRata: number | null;
  nilai: Nilai[];
}

interface BarisRekap {
  siswaId: string;
  nama: string;
  nis: string;
  nilai: Nilai[];
  perJenis: Record<string, number | null>;
  rataRata: number | null;
}

type Tab = 'rekap' | 'input' | 'siswa';

interface Konfirmasi {
  judul: string;
  pesan: string;
  tombol: string;
  /** Jika diisi, pengguna harus mengetik teks ini dulu sebelum tombol hapus aktif. */
  ketik?: string;
  aksi: () => Promise<void>;
}

// ---------- helper ----------

function rata(angka: number[]): number | null {
  return angka.length === 0 ? null : angka.reduce((a, b) => a + b, 0) / angka.length;
}

function fmt(n: number | null): string {
  return n === null ? '–' : n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtTanggal(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pesanError(err: any): string {
  return err?.response?.data?.error || err?.message || 'Terjadi kesalahan. Coba lagi.';
}

function bacaKkm(): number {
  try {
    const v = Number(localStorage.getItem('kkm'));
    return v >= 0 && v <= 100 && v !== 0 ? v : 75;
  } catch {
    return 75;
  }
}

// ---------- dialog konfirmasi ----------

function DialogKonfirmasi({ data, onClose }: { data: Konfirmasi; onClose: () => void }) {
  const [ketik, setKetik] = useState('');
  const [proses, setProses] = useState(false);
  const boleh = !data.ketik || ketik.trim() === data.ketik;

  async function jalankan() {
    setProses(true);
    try {
      await data.aksi();
    } finally {
      setProses(false);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={proses ? undefined : onClose}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-2">{data.judul}</h2>
        <p className="text-sm text-ink/70 mb-4 whitespace-pre-line">{data.pesan}</p>

        {data.ketik && (
          <div className="mb-4">
            <label className="block text-sm text-ink/70 mb-1">
              Ketik <b className="text-ink">{data.ketik}</b> untuk melanjutkan
            </label>
            <input autoFocus value={ketik} onChange={(e) => setKetik(e.target.value)} className="input" />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={proses}
            className="rounded-md border border-ink/20 text-sm px-4 py-2 hover:bg-paper disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={jalankan}
            disabled={!boleh || proses}
            className="rounded-md bg-red-600 text-white text-sm px-4 py-2 hover:bg-red-700 disabled:opacity-40"
          >
            {proses ? 'Menghapus...' : data.tombol}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- halaman ----------

export default function Kelas() {
  const [kelasList, setKelasList] = useState<KelasType[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('rekap');
  const [rekap, setRekap] = useState<RekapRow[]>([]);
  const [mapelFilter, setMapelFilter] = useState('semua');
  const [kkm, setKkm] = useState<number>(bacaKkm);
  const [dibuka, setDibuka] = useState<string | null>(null);

  const [namaKelas, setNamaKelas] = useState('');
  const [tapel, setTapel] = useState('2026/2027');
  const [namaSiswa, setNamaSiswa] = useState('');
  const [nisSiswa, setNisSiswa] = useState('');

  const [bulkMapel, setBulkMapel] = useState('');
  const [bulkJenis, setBulkJenis] = useState('Tugas');
  const [bulkNilai, setBulkNilai] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<Konfirmasi | null>(null);

  function notif(tipe: 'ok' | 'err', teks: string) {
    setPesan({ tipe, teks });
    window.setTimeout(() => setPesan(null), 4000);
  }

  async function muatKelas() {
    const res = await client.get('/kelas');
    setKelasList(res.data.kelas);
    setMemuat(false);
  }

  async function muatRekap(kelasId: string) {
    const res = await client.get(`/nilai/rekap/${kelasId}`);
    setRekap(res.data.rekap);
  }

  useEffect(() => {
    muatKelas().catch((e) => {
      setMemuat(false);
      notif('err', pesanError(e));
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setRekap([]);
    setTab('rekap');
    setMapelFilter('semua');
    setDibuka(null);
    setBulkNilai({});
    muatRekap(selected).catch((e) => notif('err', pesanError(e)));
  }, [selected]);

  const kelasAktif = kelasList.find((k) => k.id === selected) ?? null;
  const siswaAktif = useMemo(
    () => [...(kelasAktif?.siswa ?? [])].sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    [kelasAktif]
  );

  const daftarMapel = useMemo(
    () => Array.from(new Set(rekap.flatMap((r) => r.nilai.map((n) => n.mapel)))).sort(),
    [rekap]
  );

  const baris: BarisRekap[] = useMemo(
    () =>
      rekap.map((r) => {
        const nilai = mapelFilter === 'semua' ? r.nilai : r.nilai.filter((n) => n.mapel === mapelFilter);
        const perJenis: Record<string, number | null> = {};
        JENIS_LIST.forEach((j) => {
          perJenis[j.kode] = rata(nilai.filter((n) => n.jenis === j.kode).map((n) => n.nilai));
        });
        return { siswaId: r.siswaId, nama: r.nama, nis: r.nis, nilai, perJenis, rataRata: rata(nilai.map((n) => n.nilai)) };
      }),
    [rekap, mapelFilter]
  );

  const statistik = useMemo(() => {
    const dengan = baris.filter((b) => b.rataRata !== null).map((b) => b.rataRata as number);
    return {
      jumlahSiswa: baris.length,
      rataKelas: rata(dengan),
      tertinggi: dengan.length ? Math.max(...dengan) : null,
      terendah: dengan.length ? Math.min(...dengan) : null,
      belumTuntas: dengan.filter((n) => n < kkm).length,
      belumAdaNilai: baris.length - dengan.length,
    };
  }, [baris, kkm]);

  // ---------- aksi ----------

  async function handleBuatKelas(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await client.post('/kelas', { nama: namaKelas, tapel });
      setNamaKelas('');
      await muatKelas();
      setSelected(res.data.kelas.id);
      notif('ok', `Kelas ${res.data.kelas.nama} dibuat.`);
    } catch (err) {
      notif('err', pesanError(err));
    }
  }

  async function handleTambahSiswa(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await client.post('/siswa', { nama: namaSiswa, nis: nisSiswa, kelasId: selected });
      setNamaSiswa('');
      setNisSiswa('');
      await Promise.all([muatKelas(), muatRekap(selected)]);
      notif('ok', 'Siswa ditambahkan.');
    } catch (err) {
      notif('err', pesanError(err));
    }
  }

  function mintaHapusKelas() {
    if (!kelasAktif) return;
    const jumlahNilai = rekap.reduce((sum, r) => sum + r.nilai.length, 0);
    setKonfirmasi({
      judul: `Hapus kelas ${kelasAktif.nama}?`,
      pesan:
        `${kelasAktif.siswa.length} siswa dan ${jumlahNilai} nilai di kelas ini akan ikut terhapus PERMANEN.\n` +
        'Tindakan ini tidak bisa dibatalkan.',
      tombol: 'Ya, hapus kelas',
      ketik: kelasAktif.nama,
      aksi: async () => {
        try {
          await client.delete(`/kelas/${kelasAktif.id}`);
          setSelected(null);
          setRekap([]);
          await muatKelas();
          notif('ok', `Kelas ${kelasAktif.nama} dihapus.`);
        } catch (err) {
          notif('err', pesanError(err));
        }
      },
    });
  }

  function mintaHapusSiswa(id: string, nama: string) {
    setKonfirmasi({
      judul: `Hapus ${nama}?`,
      pesan: 'Seluruh nilai siswa ini juga akan terhapus. Tindakan ini tidak bisa dibatalkan.',
      tombol: 'Ya, hapus siswa',
      aksi: async () => {
        try {
          await client.delete(`/siswa/${id}`);
          if (selected) await Promise.all([muatKelas(), muatRekap(selected)]);
          notif('ok', `${nama} dihapus.`);
        } catch (err) {
          notif('err', pesanError(err));
        }
      },
    });
  }

  function mintaHapusNilai(n: Nilai, namaSiswa: string) {
    setKonfirmasi({
      judul: 'Hapus nilai ini?',
      pesan: `${namaSiswa} · ${n.mapel} · ${n.jenis} · ${n.nilai}`,
      tombol: 'Ya, hapus nilai',
      aksi: async () => {
        try {
          await client.delete(`/nilai/${n.id}`);
          if (selected) await muatRekap(selected);
          notif('ok', 'Nilai dihapus.');
        } catch (err) {
          notif('err', pesanError(err));
        }
      },
    });
  }

  // Input nilai massal
  const isianBulk = siswaAktif
    .map((s) => ({ siswaId: s.id, mentah: (bulkNilai[s.id] ?? '').trim() }))
    .filter((x) => x.mentah !== '')
    .map((x) => {
      const angka = Number(x.mentah.replace(',', '.'));
      return { ...x, angka, valid: Number.isFinite(angka) && angka >= 0 && angka <= 100 };
    });
  const adaIsianSalah = isianBulk.some((x) => !x.valid);
  const bisaSimpan = bulkMapel.trim() !== '' && isianBulk.length > 0 && !adaIsianSalah && !menyimpan;

  async function handleSimpanBulk(e: FormEvent) {
    e.preventDefault();
    if (!selected || !bisaSimpan) return;
    setMenyimpan(true);
    try {
      const res = await client.post('/nilai/batch', {
        kelasId: selected,
        mapel: bulkMapel.trim(),
        jenis: bulkJenis,
        items: isianBulk.map((x) => ({ siswaId: x.siswaId, nilai: x.angka })),
      });
      setBulkNilai({});
      await muatRekap(selected);
      setTab('rekap');
      notif('ok', `${res.data.jumlah} nilai ${bulkJenis} ${bulkMapel.trim()} tersimpan.`);
    } catch (err) {
      notif('err', pesanError(err));
    } finally {
      setMenyimpan(false);
    }
  }

  function ubahKkm(v: string) {
    const n = Math.min(100, Math.max(1, Number(v) || 0));
    setKkm(n);
    try {
      localStorage.setItem('kkm', String(n));
    } catch {
      /* abaikan */
    }
  }

  // ---------- tampilan ----------

  const kelasTab = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        tab === id ? 'border-forest-700 text-forest-700 font-medium' : 'border-transparent text-ink/60 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Kelas & Nilai</h1>
        <p className="text-sm text-ink/60 mt-1">Kelola kelas, daftar siswa, dan rekap nilai di satu tempat.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ===== Kolom kiri: daftar kelas ===== */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-ink/10 p-4">
            <p className="font-medium mb-3">Kelasku</p>
            {memuat ? (
              <p className="text-sm text-ink/60 mb-3">Memuat...</p>
            ) : kelasList.length === 0 ? (
              <p className="text-sm text-ink/60 mb-3">Belum ada kelas. Tambahkan kelas pertama Anda di bawah.</p>
            ) : (
              <div className="space-y-1 mb-4">
                {kelasList.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setSelected(k.id)}
                    className={`w-full text-left rounded-md px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                      selected === k.id ? 'bg-forest-50 text-forest-700 font-medium' : 'hover:bg-paper'
                    }`}
                  >
                    <span>
                      {k.nama} <span className="text-ink/40 font-normal">· {k.tapel}</span>
                    </span>
                    <span className="text-xs text-ink/50 font-normal shrink-0">{k.siswa.length} siswa</span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleBuatKelas} className="space-y-2 border-t border-ink/10 pt-4">
              <p className="text-xs text-ink/50">Tambah kelas baru</p>
              <input
                required
                placeholder="Nama kelas, contoh: 8B"
                value={namaKelas}
                onChange={(e) => setNamaKelas(e.target.value)}
                className="input"
              />
              <input
                required
                placeholder="Tahun pelajaran"
                value={tapel}
                onChange={(e) => setTapel(e.target.value)}
                className="input"
              />
              <button type="submit" className="w-full rounded-md bg-forest-700 text-white text-sm py-1.5 hover:bg-forest-900">
                Tambah kelas
              </button>
            </form>
          </div>
        </div>

        {/* ===== Kolom kanan ===== */}
        <div className="min-w-0">
          {!kelasAktif ? (
            <div className="bg-white rounded-lg border border-dashed border-ink/20 p-10">
              <p className="font-medium text-center mb-4">Pilih atau tambahkan kelas untuk memulai</p>
              <ol className="text-sm text-ink/70 space-y-2 max-w-sm mx-auto list-decimal list-inside">
                <li>Tambahkan kelas di panel kiri.</li>
                <li>Buka kelas, lalu isi daftar siswa di tab <b>Siswa</b>.</li>
                <li>Catat nilai satu kelas sekaligus di tab <b>Input nilai</b>.</li>
                <li>Lihat rata-rata dan ketuntasan di tab <b>Rekap nilai</b>.</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header kelas */}
              <div className="bg-white rounded-lg border border-ink/10 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">
                    Kelas {kelasAktif.nama} <span className="text-ink/40 font-normal text-base">· {kelasAktif.tapel}</span>
                  </p>
                  <p className="text-sm text-ink/60">{kelasAktif.siswa.length} siswa</p>
                </div>
                <button
                  onClick={mintaHapusKelas}
                  className="shrink-0 rounded-md border border-red-300 text-red-600 text-sm px-3 py-1.5 hover:bg-red-50"
                >
                  Hapus kelas
                </button>
              </div>

              {/* Tab */}
              <div className="flex border-b border-ink/10">
                {kelasTab('rekap', 'Rekap nilai')}
                {kelasTab('input', 'Input nilai')}
                {kelasTab('siswa', 'Siswa')}
              </div>

              {/* ===== TAB REKAP ===== */}
              {tab === 'rekap' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg border border-ink/10 p-3">
                      <p className="text-xs text-ink/50">Jumlah siswa</p>
                      <p className="text-xl font-semibold">{statistik.jumlahSiswa}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-ink/10 p-3">
                      <p className="text-xs text-ink/50">Rata-rata kelas</p>
                      <p className="text-xl font-semibold">{fmt(statistik.rataKelas)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-ink/10 p-3">
                      <p className="text-xs text-ink/50">Tertinggi / terendah</p>
                      <p className="text-xl font-semibold">
                        {fmt(statistik.tertinggi)} <span className="text-ink/30">/</span> {fmt(statistik.terendah)}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg border border-ink/10 p-3">
                      <p className="text-xs text-ink/50">Belum tuntas (&lt; {kkm})</p>
                      <p className={`text-xl font-semibold ${statistik.belumTuntas > 0 ? 'text-red-600' : ''}`}>
                        {statistik.belumTuntas}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <span className="text-ink/60">Mata pelajaran</span>
                      <select value={mapelFilter} onChange={(e) => setMapelFilter(e.target.value)} className="input !w-auto">
                        <option value="semua">Semua</option>
                        {daftarMapel.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-ink/60">KKM</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={kkm}
                        onChange={(e) => ubahKkm(e.target.value)}
                        className="input !w-20"
                      />
                    </label>
                  </div>

                  {kelasAktif.siswa.length === 0 ? (
                    <div className="bg-white rounded-lg border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">
                      Belum ada siswa di kelas ini.{' '}
                      <button onClick={() => setTab('siswa')} className="text-forest-700 font-medium hover:underline">
                        Tambah siswa
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-ink/10 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-paper text-ink/60 text-left">
                          <tr>
                            <th className="px-4 py-2 font-medium">Siswa</th>
                            {JENIS_LIST.map((j) => (
                              <th key={j.kode} className="px-3 py-2 font-medium text-center" title={j.label}>
                                {j.kode}
                              </th>
                            ))}
                            <th className="px-3 py-2 font-medium text-center">Rata-rata</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {baris.map((b) => {
                            const terbuka = dibuka === b.siswaId;
                            const tuntas = b.rataRata !== null && b.rataRata >= kkm;
                            return (
                              <Fragment key={b.siswaId}>
                                <tr
                                  onClick={() => setDibuka(terbuka ? null : b.siswaId)}
                                  className="border-t border-ink/10 cursor-pointer hover:bg-paper/60"
                                >
                                  <td className="px-4 py-2">
                                    <span className="text-ink/40 mr-1">{terbuka ? '▾' : '▸'}</span>
                                    {b.nama}
                                    <span className="block text-xs text-ink/40 pl-4">NIS {b.nis}</span>
                                  </td>
                                  {JENIS_LIST.map((j) => (
                                    <td key={j.kode} className="px-3 py-2 text-center text-ink/70">
                                      {fmt(b.perJenis[j.kode])}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2 text-center font-semibold">{fmt(b.rataRata)}</td>
                                  <td className="px-4 py-2">
                                    {b.rataRata === null ? (
                                      <span className="text-xs text-ink/40">Belum ada nilai</span>
                                    ) : tuntas ? (
                                      <span className="rounded-full bg-forest-50 text-forest-700 text-xs font-medium px-2.5 py-0.5">
                                        Tuntas
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-red-50 text-red-600 text-xs font-medium px-2.5 py-0.5">
                                        Belum tuntas
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                {terbuka && (
                                  <tr className="bg-paper/50">
                                    <td colSpan={7} className="px-4 py-3">
                                      {b.nilai.length === 0 ? (
                                        <p className="text-sm text-ink/50">Belum ada nilai untuk filter ini.</p>
                                      ) : (
                                        <table className="w-full text-xs">
                                          <thead className="text-ink/50 text-left">
                                            <tr>
                                              <th className="py-1 font-medium">Tanggal</th>
                                              <th className="py-1 font-medium">Mata pelajaran</th>
                                              <th className="py-1 font-medium">Jenis</th>
                                              <th className="py-1 font-medium text-right">Nilai</th>
                                              <th className="py-1 w-16" />
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {b.nilai.map((n) => (
                                              <tr key={n.id} className="border-t border-ink/10">
                                                <td className="py-1.5">{fmtTanggal(n.tanggal)}</td>
                                                <td className="py-1.5">{n.mapel}</td>
                                                <td className="py-1.5">{n.jenis}</td>
                                                <td
                                                  className={`py-1.5 text-right font-medium ${
                                                    n.nilai < kkm ? 'text-red-600' : ''
                                                  }`}
                                                >
                                                  {n.nilai.toLocaleString('id-ID')}
                                                </td>
                                                <td className="py-1.5 text-right">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      mintaHapusNilai(n, b.nama);
                                                    }}
                                                    className="text-red-600 hover:underline"
                                                  >
                                                    Hapus
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="text-xs text-ink/50">
                    Kolom Tugas/UH/UTS/UAS menampilkan rata-rata tiap jenis. Rata-rata adalah rata-rata seluruh nilai
                    siswa{mapelFilter === 'semua' ? '' : ` pada ${mapelFilter}`}. Siswa tuntas jika rata-rata ≥ KKM.
                    {statistik.belumAdaNilai > 0 && ` ${statistik.belumAdaNilai} siswa belum punya nilai.`} Klik baris siswa
                    untuk melihat atau menghapus nilainya satu per satu.
                  </p>
                </div>
              )}

              {tab === 'input' && (
                <form onSubmit={handleSimpanBulk} className="bg-white rounded-lg border border-ink/10 p-4 space-y-4">
                  {kelasAktif.siswa.length === 0 ? (
                    <p className="text-sm text-ink/60">
                      Belum ada siswa.{' '}
                      <button type="button" onClick={() => setTab('siswa')} className="text-forest-700 font-medium hover:underline">
                        Tambah siswa dulu
                      </button>
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-ink/60">
                        Pilih mata pelajaran dan jenis penilaian, lalu isi nilai siswa (0–100). Kosongkan baris siswa yang
                        belum ada nilainya.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-sm">
                          <span className="block text-ink/60 mb-1">Mata pelajaran</span>
                          <input
                            required
                            list="daftar-mapel"
                            placeholder="contoh: Matematika"
                            value={bulkMapel}
                            onChange={(e) => setBulkMapel(e.target.value)}
                            className="input"
                          />
                          <datalist id="daftar-mapel">
                            {daftarMapel.map((m) => (
                              <option key={m} value={m} />
                            ))}
                          </datalist>
                        </label>
                        <label className="text-sm">
                          <span className="block text-ink/60 mb-1">Jenis penilaian</span>
                          <select value={bulkJenis} onChange={(e) => setBulkJenis(e.target.value)} className="input">
                            {JENIS_LIST.map((j) => (
                              <option key={j.kode} value={j.kode}>
                                {j.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="border border-ink/10 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-paper text-ink/60 text-left">
                            <tr>
                              <th className="px-4 py-2 font-medium w-10">No</th>
                              <th className="px-4 py-2 font-medium">Siswa</th>
                              <th className="px-4 py-2 font-medium w-32">Nilai</th>
                            </tr>
                          </thead>
                          <tbody>
                            {siswaAktif.map((s, i) => {
                              const mentah = (bulkNilai[s.id] ?? '').trim();
                              const angka = Number(mentah.replace(',', '.'));
                              const salah = mentah !== '' && !(Number.isFinite(angka) && angka >= 0 && angka <= 100);
                              return (
                                <tr key={s.id} className="border-t border-ink/10">
                                  <td className="px-4 py-1.5 text-ink/40">{i + 1}</td>
                                  <td className="px-4 py-1.5">
                                    {s.nama}
                                    <span className="text-xs text-ink/40 ml-2">NIS {s.nis}</span>
                                  </td>
                                  <td className="px-4 py-1.5">
                                    <input
                                      inputMode="decimal"
                                      value={bulkNilai[s.id] ?? ''}
                                      onChange={(e) => setBulkNilai({ ...bulkNilai, [s.id]: e.target.value })}
                                      className={`input !py-1 ${salah ? '!border-red-400' : ''}`}
                                      aria-invalid={salah}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {adaIsianSalah && <p className="text-sm text-red-600">Nilai harus berupa angka 0–100.</p>}

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-ink/60">{isianBulk.length} dari {siswaAktif.length} siswa terisi</p>
                        <button
                          type="submit"
                          disabled={!bisaSimpan}
                          className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900 disabled:opacity-40"
                        >
                          {menyimpan ? 'Menyimpan...' : `Simpan ${isianBulk.length} nilai`}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}

              {/* ===== TAB SISWA ===== */}
              {tab === 'siswa' && (
                <div className="space-y-4">
                  <ImporSiswa
                    kelasId={kelasAktif.id}
                    siswaAda={kelasAktif.siswa}
                    onSelesai={async (teks) => {
                      await Promise.all([muatKelas(), muatRekap(kelasAktif.id)]);
                      notif('ok', teks);
                    }}
                    onError={(teks) => notif('err', teks)}
                  />

                  <form
                    onSubmit={handleTambahSiswa}
                    className="bg-white rounded-lg border border-ink/10 p-4 grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-2 items-end"
                  >
                    <p className="sm:col-span-3 font-medium">Tambah satu siswa</p>
                    <label className="text-sm">
                      <span className="block text-ink/60 mb-1">Nama siswa</span>
                      <input required value={namaSiswa} onChange={(e) => setNamaSiswa(e.target.value)} className="input" />
                    </label>
                    <label className="text-sm">
                      <span className="block text-ink/60 mb-1">NIS</span>
                      <input required value={nisSiswa} onChange={(e) => setNisSiswa(e.target.value)} className="input" />
                    </label>
                    <button type="submit" className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900">
                      Tambah siswa
                    </button>
                  </form>

                  {siswaAktif.length === 0 ? (
                    <div className="bg-white rounded-lg border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">
                      Belum ada siswa di kelas ini.
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-ink/10 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-paper text-ink/60 text-left">
                          <tr>
                            <th className="px-4 py-2 font-medium w-10">No</th>
                            <th className="px-4 py-2 font-medium">Nama</th>
                            <th className="px-4 py-2 font-medium">NIS</th>
                            <th className="px-4 py-2 w-20" />
                          </tr>
                        </thead>
                        <tbody>
                          {siswaAktif.map((s, i) => (
                            <tr key={s.id} className="border-t border-ink/10">
                              <td className="px-4 py-2 text-ink/40">{i + 1}</td>
                              <td className="px-4 py-2">{s.nama}</td>
                              <td className="px-4 py-2 text-ink/60">{s.nis}</td>
                              <td className="px-4 py-2 text-right">
                                <button onClick={() => mintaHapusSiswa(s.id, s.nama)} className="text-red-600 text-xs hover:underline">
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notifikasi */}
      {pesan && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-3 text-sm shadow-lg ${
            pesan.tipe === 'ok' ? 'bg-forest-700 text-white' : 'bg-red-600 text-white'
          }`}
          role="status"
        >
          {pesan.teks}
        </div>
      )}

      {konfirmasi && <DialogKonfirmasi data={konfirmasi} onClose={() => setKonfirmasi(null)} />}
    </div>
  );
}
