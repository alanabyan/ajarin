import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header, Ikon, Kolom, Kosong, Memuat, Pesan, Sampul, SelectPil, propsKontrol, useCari } from '../components/ui';
import { cocok, teksKelas } from '../lib/cari';
import api, { kolomError, pesanError } from '../lib/api';
import {
  JENJANG,
  KELAS_PER_JENJANG,
  JURUSAN_SMA,
  JURUSAN_SMK,
  ROMBEL,
  TINGKAT_ATAS,
  namaKelasBaku,
  normJurusan,
  pilihanTapel,
  tapelSekarang,
} from '../lib/akademik';
import { useAuth } from '../lib/auth';
import type { KelasRingkas, Siswa } from '../types';

interface IsianKelas {
  tingkat: string;
  jurusan: string;
  rombel: string;
  tapel: string;
  kkm: string;
}

function validasiKelas(f: IsianKelas, wajibJurusan: boolean): Record<string, string> {
  const g: Record<string, string> = {};
  if (!f.tingkat) g.tingkat = 'Pilih tingkat kelas.';
  const atas = TINGKAT_ATAS.includes(f.tingkat);
  const jurusan = normJurusan(f.jurusan);
  if (atas && jurusan && !/^[A-Z]{2,12}$/.test(jurusan)) g.jurusan = 'Singkatan 2–12 huruf tanpa angka, mis. RPL, TKJ, IPA.';
  if (atas && wajibJurusan && !jurusan) g.jurusan = 'Jurusan wajib diisi untuk SMK.';
  const kkm = Number(f.kkm);
  if (f.kkm.trim() === '' || !Number.isInteger(kkm) || kkm < 0 || kkm > 100) g.kkm = 'KKM berupa bilangan bulat 0–100.';
  return g;
}

/**
 * Formulir kelas baru. Nama kelas tidak diketik bebas, tetapi disusun dari tingkat (Romawi) + jurusan + rombel,
 * supaya kelas yang sama tidak tercatat dengan penulisan berbeda ("10 RPL 1", "X RPL1", "x rpl 1").
 */
function FormKelas({ onSelesai }: { onSelesai: () => Promise<void> }) {
  const { user } = useAuth();
  const jenjang = user?.jenjang ?? 'SMP';
  const [f, setF] = useState<IsianKelas>({
    tingkat: KELAS_PER_JENJANG[jenjang][0],
    jurusan: '',
    rombel: '',
    tapel: tapelSekarang(),
    kkm: '75',
  });
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const atas = TINGKAT_ATAS.includes(f.tingkat);
  const wajibJurusan = jenjang === 'SMK';
  // Guru SMK melihat daftar SMK lebih dulu; guru SMA/lainnya melihat IPA/IPS/Bahasa lebih dulu.
  const grupJurusan: [string, [string, string][]][] =
    jenjang === 'SMK'
      ? [
          ['SMK', JURUSAN_SMK],
          ['SMA', JURUSAN_SMA],
        ]
      : [
          ['SMA', JURUSAN_SMA],
          ['SMK', JURUSAN_SMK],
        ];
  const dikenal = [...JURUSAN_SMA, ...JURUSAN_SMK].some(([k]) => k === f.jurusan);
  const [ketikJurusan, setKetikJurusan] = useState(false);
  const lainnya = ketikJurusan || (f.jurusan !== '' && !dikenal);
  const nama = namaKelasBaku(f.tingkat, atas ? f.jurusan : '', f.rombel);

  const atur = <K extends keyof IsianKelas>(k: K, v: string) => {
    setF((lama) => ({ ...lama, [k]: v }));
    if (kolom[k]) setKolom(({ [k]: _, ...sisa }) => sisa);
  };

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat('');
    const g = validasiKelas(f, wajibJurusan);
    setKolom(g);
    if (Object.keys(g).length) return;
    setSibuk(true);
    try {
      await api.post('/kelas', {
        tingkat: f.tingkat,
        jurusan: atas ? normJurusan(f.jurusan) : '',
        rombel: f.rombel,
        tapel: f.tapel,
        kkm: Number(f.kkm),
      });
      await onSelesai();
    } catch (err) {
      setKolom(kolomError(err));
      setGalat(pesanError(err, 'Gagal membuat kelas.'));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={kirim} noValidate className="kartu mb-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Kolom id="tingkat" label="Tingkat" galat={kolom.tingkat}>
          <select {...propsKontrol('tingkat', kolom.tingkat)} value={f.tingkat} onChange={(e) => atur('tingkat', e.target.value)}>
            {/* SMA dan SMK sama-sama X-XII, jadi cukup satu grup sesuai jenjang guru. */}
            {JENJANG.filter((j) => j !== (jenjang === 'SMK' ? 'SMA' : 'SMK')).map((j) => (
              <optgroup key={j} label={j}>
                {KELAS_PER_JENJANG[j].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Kolom>
        <div className="sm:col-span-2">
          <Kolom
            id="jurusan"
            label={`Jurusan${wajibJurusan ? '' : ' (opsional)'}`}
            galat={kolom.jurusan}
            petunjuk={atas ? 'Singkatannya dipakai di nama kelas.' : 'Hanya untuk kelas X–XII.'}
          >
            <select
              {...propsKontrol('jurusan', kolom.jurusan, true)}
              disabled={!atas}
              value={!atas ? '' : lainnya ? '__lainnya__' : f.jurusan}
              onChange={(e) => {
                const v = e.target.value;
                setKetikJurusan(v === '__lainnya__');
                atur('jurusan', v === '__lainnya__' ? '' : v);
              }}
            >
              <option value="">{!atas ? '-' : wajibJurusan ? 'Pilih jurusan' : 'Tanpa jurusan'}</option>
              {grupJurusan.map(([grup, daftar]) => (
                <optgroup key={grup} label={grup}>
                  {daftar.map(([kode, namaJurusan]) => (
                    <option key={kode} value={kode}>
                      {kode} – {namaJurusan}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="__lainnya__">Lainnya (ketik singkatan)</option>
            </select>
            {atas && lainnya && (
              <input
                aria-label="Singkatan jurusan lainnya"
                maxLength={12}
                placeholder="Singkatan, mis. TJKT"
                className={`${propsKontrol('jurusan', kolom.jurusan).className} mt-2`}
                value={f.jurusan}
                onChange={(e) => atur('jurusan', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              />
            )}
          </Kolom>
        </div>
        <Kolom id="rombel" label="Rombel" galat={kolom.rombel} petunjuk="Nomor/huruf kelas paralel.">
          <select {...propsKontrol('rombel', kolom.rombel, true)} value={f.rombel} onChange={(e) => atur('rombel', e.target.value)}>
            <option value="">Tanpa rombel</option>
            {ROMBEL.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Kolom>
        <Kolom id="tapel" label="Tahun pelajaran" galat={kolom.tapel}>
          <select {...propsKontrol('tapel', kolom.tapel)} value={f.tapel} onChange={(e) => atur('tapel', e.target.value)}>
            {pilihanTapel().map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Kolom>
        <Kolom id="kkm" label="KKM" galat={kolom.kkm}>
          <input
            {...propsKontrol('kkm', kolom.kkm)}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={f.kkm}
            onChange={(e) => atur('kkm', e.target.value)}
          />
        </Kolom>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-tinta-500">
          Nama kelas: <b className="text-lg text-ajarin-600">{nama}</b> <span className="text-tinta-500">· {f.tapel}</span>
        </p>
        <button type="submit" disabled={sibuk} className="btn-utama py-3">
          {sibuk ? 'Menyimpan...' : 'Tambah kelas'}
        </button>
      </div>
      {galat && <Pesan nada="galat">{galat}</Pesan>}
    </form>
  );
}

export default function KelasList() {
  const [daftar, setDaftar] = useState<KelasRingkas[] | null>(null);
  const [bukaForm, setBukaForm] = useState(false);
  const [galat, setGalat] = useState('');
  const cari = useCari();

  // Daftar siswa di bagian bawah: dimuat per kelas yang dipilih.
  const [kelasId, setKelasId] = useState('');
  const [siswa, setSiswa] = useState<Siswa[]>([]);
  const [cariSiswa, setCariSiswa] = useState('');

  const muat = () =>
    api
      .get('/kelas')
      .then((r) => setDaftar(r.data.kelas))
      .catch((e) => {
        setGalat(pesanError(e));
        setDaftar([]);
      });

  const muatSiswa = (id: string) =>
    id
      ? api
          .get(`/kelas/${id}`)
          .then((r) => setSiswa(r.data.siswa))
          .catch((e) => setGalat(pesanError(e)))
      : Promise.resolve(setSiswa([]));

  useEffect(() => {
    void muat();
  }, []);

  useEffect(() => {
    void muatSiswa(kelasId);
  }, [kelasId]);

  // Pilihan awal: kelas pertama, supaya tabel siswa langsung terisi.
  useEffect(() => {
    if (daftar && daftar.length > 0 && !daftar.some((k) => k.id === kelasId)) setKelasId(daftar[0].id);
  }, [daftar]); // eslint-disable-line react-hooks/exhaustive-deps

  async function hapusKelas(k: KelasRingkas) {
    if (!window.confirm(`Hapus kelas ${k.nama} beserta seluruh siswa dan nilainya? Tindakan ini tidak bisa dibatalkan.`)) return;
    setGalat('');
    try {
      await api.delete(`/kelas/${k.id}`);
      await muat();
    } catch (e) {
      setGalat(pesanError(e));
    }
  }

  async function hapusSiswa(s: Siswa) {
    if (!window.confirm(`Hapus ${s.nama} beserta seluruh nilainya?`)) return;
    setGalat('');
    try {
      await api.delete(`/kelas/siswa/${s.id}`);
      await Promise.all([muatSiswa(kelasId), muat()]);
    } catch (e) {
      setGalat(pesanError(e));
    }
  }

  if (!daftar) return <Memuat />;

  const tampil = daftar.filter((k) => cocok(teksKelas(k), cari));
  const kelasTerpilih = daftar.find((k) => k.id === kelasId);
  const q = cariSiswa.trim().toLowerCase();
  const siswaTampil = siswa.filter((s) => `${s.nama} ${s.nis}`.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <div>
        <Header
          judul="Daftar Semua Kelas"
          aksi={
            <button type="button" onClick={() => setBukaForm((v) => !v)} aria-expanded={bukaForm} className="btn-utama px-7 py-3.5 text-base">
              Buat Kelas <Ikon nama="plus" className="h-4 w-4" />
            </button>
          }
        />

        {bukaForm && (
          <FormKelas
            onSelesai={async () => {
              setBukaForm(false);
              await muat();
            }}
          />
        )}
        {galat && (
          <div className="mb-4">
            <Pesan nada="galat">{galat}</Pesan>
          </div>
        )}

        {daftar.length === 0 ? (
          <Kosong judul="Belum ada kelas" isi="Tambahkan kelas lewat tombol Buat Kelas, lalu isi daftar siswanya." />
        ) : tampil.length === 0 ? (
          <p className="text-sm text-tinta-500">Tidak ada kelas yang cocok dengan pencarian.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {tampil.map((k) => (
              <li key={k.id} className="flex flex-col gap-2.5 rounded-[20px] bg-white p-3 shadow-kartu">
                <Sampul varian="kelas" lencana={k.tapel} className="!aspect-auto h-[130px] !rounded-xl" />
                <div className="flex items-center justify-between gap-2.5 px-1">
                  <h2 className="min-w-0 flex-1 truncate text-base font-bold text-[#202020]">Kelas {k.nama}</h2>
                  <span className="shrink-0 text-[10px] font-semibold text-ajarin-200">{k.jumlahSiswa} siswa</span>
                </div>
                <div className="flex gap-[7px]">
                  <Link to={`/kelas/${k.id}`} className="flex flex-1 items-center justify-center rounded-[7px] bg-ajarin-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-ajarin-600">
                    Detail Kelas
                  </Link>
                  <button
                    type="button"
                    onClick={() => hapusKelas(k)}
                    aria-label={`Hapus kelas ${k.nama}`}
                    className="flex w-[35px] shrink-0 items-center justify-center rounded-[7px] border border-merah text-merah hover:bg-red-50"
                  >
                    <Ikon nama="hapus" className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {daftar.length > 0 && (
        <section className="kartu shadow-kartu sm:p-5" aria-labelledby="judul-siswa">
          <div className="mb-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 id="judul-siswa" className="text-xl font-bold">
              Daftar Siswa
            </h2>
            <div className="flex flex-col gap-[7px] sm:flex-row lg:w-[34rem]">
              <SelectPil aria-label="Pilih kelas" className="sm:w-48" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
                {daftar.map((k) => (
                  <option key={k.id} value={k.id}>
                    Kelas {k.nama}
                  </option>
                ))}
              </SelectPil>
              <div className="relative flex-1">
                <Ikon nama="cari" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-300" />
                <input
                  type="search"
                  aria-label="Cari siswa"
                  placeholder="Search..."
                  className="input-pil pl-11"
                  value={cariSiswa}
                  onChange={(e) => setCariSiswa(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-[7px] border border-[#E6E6E6]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[#E6E6E6] text-left font-semibold text-ajarin-700">
                  <th className="w-16 px-4 py-3.5">No</th>
                  <th className="px-4 py-3.5">Nama Siswa</th>
                  <th className="px-4 py-3.5 text-center">Kelas</th>
                  <th className="px-4 py-3.5 text-center">NIS</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="font-medium text-tinta-400">
                {siswaTampil.map((s, i) => (
                  <tr key={s.id} className="border-b border-[#E6E6E6] last:border-0">
                    <td className="px-4 py-3">{i + 1}</td>
                    <td className="px-4 py-3">{s.nama}</td>
                    <td className="px-4 py-3 text-center">{kelasTerpilih?.nama}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{s.nis}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => hapusSiswa(s)} className="font-semibold text-merah hover:underline">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
                {siswaTampil.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-tinta-500">
                      {siswa.length === 0 ? 'Belum ada siswa di kelas ini. Tambahkan lewat Detail Kelas.' : 'Tidak ada siswa yang cocok.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
