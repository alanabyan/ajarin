import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ImporNilai from '../components/ImporNilai';
import { Inline } from '../components/Markdown';
import { Header, Memuat, Pesan } from '../components/ui';
import api, { pesanError, unduh } from '../lib/api';
import { mintaTokenGoogle, muatGoogle } from '../lib/google';
import { useJaringan } from '../lib/offline/jaringan';
import { Link } from 'react-router-dom';
import type { Butir, KelasRingkas, SetSoal } from '../types';

const HURUF = ['A', 'B', 'C', 'D'];

function KartuButir({ b, bisaUbah, onSimpan }: { b: Butir; bisaUbah: boolean; onSimpan: (b: Butir) => Promise<void> }) {
  const [ubah, setUbah] = useState(false);
  const [draf, setDraf] = useState(b);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  async function simpan() {
    setSibuk(true);
    setGalat('');
    try {
      await onSimpan(draf);
      setUbah(false);
    } catch (e) {
      setGalat(pesanError(e, 'Gagal menyimpan soal.'));
    } finally {
      setSibuk(false);
    }
  }

  if (ubah) {
    return (
      <div className="kartu space-y-3">
        <p className="font-semibold">Sunting soal {b.urutan}</p>
        <textarea aria-label="Pertanyaan" rows={3} className="input" value={draf.pertanyaan} onChange={(e) => setDraf({ ...draf, pertanyaan: e.target.value })} />
        {draf.pilihan.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name={`kunci-${b.id}`} aria-label={`Jadikan ${HURUF[i]} sebagai kunci`} checked={draf.kunci === i} onChange={() => setDraf({ ...draf, kunci: i })} />
            <span className="w-5 text-sm font-medium">{HURUF[i]}.</span>
            <input aria-label={`Pilihan ${HURUF[i]}`} className="input" value={p} onChange={(e) => setDraf({ ...draf, pilihan: draf.pilihan.map((x, n) => (n === i ? e.target.value : x)) })} />
          </div>
        ))}
        <textarea aria-label="Pembahasan" rows={2} className="input" value={draf.pembahasan} onChange={(e) => setDraf({ ...draf, pembahasan: e.target.value })} />
        {galat && <Pesan nada="galat">{galat}</Pesan>}
        <div className="flex gap-2">
          <button type="button" onClick={simpan} disabled={sibuk} className="btn-utama">
            {sibuk ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button type="button" onClick={() => { setDraf(b); setUbah(false); }} className="btn-garis">
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`kartu ${b.ragu ? 'border-pelita-400' : ''}`}>
      {b.ragu && (
        <p className="mb-3 rounded-md bg-pelita-50 px-3 py-2 text-sm text-pelita-700">
          <b>Periksa kunci jawaban.</b> Saat dikerjakan ulang oleh AI, jawabannya berbeda dari kunci soal ini. Kunci atau soalnya mungkin keliru.
          {bisaUbah ? ' Klik Sunting untuk memeriksa; penanda hilang setelah Anda menyimpan.' : ''}
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {b.urutan}. <Inline>{b.pertanyaan}</Inline>
        </p>
        {bisaUbah && (
          <button type="button" onClick={() => { setDraf(b); setUbah(true); }} className="tanpa-cetak btn-garis shrink-0 py-1">
            Sunting
          </button>
        )}
      </div>
      <ul className="my-3 space-y-1">
        {b.pilihan.map((p, i) => (
          <li key={i} className={`rounded-md px-3 py-1.5 text-sm ${i === b.kunci ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-tinta-700'}`}>
            {HURUF[i]}. <Inline>{p}</Inline>
            {i === b.kunci && <span className="sr-only"> (kunci jawaban)</span>}
          </li>
        ))}
      </ul>
      <p className="border-t border-tinta-50 pt-3 text-sm text-tinta-500">
        <b>Pembahasan:</b> <Inline>{b.pembahasan}</Inline>
      </p>
    </div>
  );
}

export default function SoalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [set, setSet] = useState<SetSoal | null>(null);
  const [sibuk, setSibuk] = useState<'' | 'form' | 'kahoot' | 'lengkap' | 'word'>('');
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [bukaImpor, setBukaImpor] = useState(false);
  const [kelas, setKelas] = useState<KelasRingkas[]>([]);
  const [bukaBuat, setBukaBuat] = useState(false);
  const [kelasPilih, setKelasPilih] = useState('');
  const { online } = useJaringan();

  useEffect(() => {
    muatGoogle().catch(() => {});
    api
      .get(`/soal/${id}`)
      .then((r) => setSet(r.data.set))
      .catch((e) => setGalat(pesanError(e, 'Set soal tidak ditemukan.')));
    api.get('/kelas').then((r) => {
      const ada: KelasRingkas[] = r.data.kelas;
      setKelas(ada);
      setKelasPilih((lama) => lama || (ada.find((k) => k.jumlahSiswa > 0)?.id ?? ''));
    });
  }, [id]);

  // Set remedial untuk sebagian siswa: kelasnya sudah ditentukan, tidak boleh diganti.
  useEffect(() => {
    if (set?.targetKelasId) setKelasPilih(set.targetKelasId);
  }, [set?.targetKelasId]);

  if (!set) return galat ? <Pesan nada="galat">{galat}</Pesan> : <Memuat />;

  const sasaran = set.targetKelasId ? set.targetSiswa.length : 0;
  const kelasSasaran = kelas.find((k) => k.id === set.targetKelasId);
  const jumlahRagu = set.butir.filter((b) => b.ragu).length;

  async function ekspor(format: 'kahoot' | 'lengkap' | 'word') {
    setSibuk(format);
    setGalat('');
    setInfo('');
    try {
      const h = await unduh(`/soal/${id}/ekspor`, { format }, `${set!.judul}.${format === 'word' ? 'docx' : 'xlsx'}`);
      const lebih = Number(h['x-soal-melebihi-batas'] ?? 0);
      if (format === 'kahoot' && lebih > 0) {
        setInfo(`${lebih} soal melebihi batas karakter Kahoot (soal 120, jawaban 75) dan diberi warna merah di Excel. Persingkat dulu sebelum diunggah.`);
      }
    } catch (e) {
      setGalat(pesanError(e, 'Gagal mengunduh.'));
    } finally {
      setSibuk('');
    }
  }

  async function buatForm() {
    if (!kelasPilih) return;
    if (set!.formUrl && !window.confirm('Set ini sudah punya Google Form. Buat form BARU? Form lama tetap ada di Drive Anda, tetapi tautan di sini diganti dan jawaban lama tidak ikut terbaca.')) return;
    setSibuk('form');
    setGalat('');
    setInfo('');
    try {
      const accessToken = await mintaTokenGoogle();
      const r = await api.post(`/soal/${id}/google-form`, { accessToken, kelasId: kelasPilih });
      setSet({ ...set!, formUrl: r.data.formUrl, formEditUrl: r.data.formEditUrl, formKelasId: r.data.kelasId });
      setBukaBuat(false);
      setInfo(
        `Google Form dibuat untuk ${r.data.jumlahSiswa} siswa (${r.data.jumlahSoal} soal${r.data.dilewati ? `, ${r.data.dilewati} dilewati karena tidak valid` : ''}).` +
          (r.data.bisaDiisiSiapaSaja ? '' : ' Akses pengisian belum otomatis terbuka: di Google Forms klik Kirim lalu atur siapa yang boleh mengisi.')
      );
    } catch (e) {
      setGalat(pesanError(e, 'Gagal membuat Google Form.'));
    } finally {
      setSibuk('');
    }
  }

  async function segarkanDaftar() {
    setSibuk('form');
    setGalat('');
    setInfo('');
    try {
      const accessToken = await mintaTokenGoogle();
      const r = await api.post(`/soal/${id}/google-form/daftar-siswa`, { accessToken });
      setInfo(`Dropdown nama di form diperbarui (${r.data.jumlahSiswa} siswa).`);
    } catch (e) {
      setGalat(pesanError(e, 'Gagal memperbarui daftar nama.'));
    } finally {
      setSibuk('');
    }
  }

  async function simpanButir(b: Butir) {
    const r = await api.put(`/soal/${id}/butir/${b.id}`, { pertanyaan: b.pertanyaan, pilihan: b.pilihan, kunci: b.kunci, pembahasan: b.pembahasan });
    setSet((s) => s && { ...s, butir: s.butir.map((x) => (x.id === b.id ? r.data.butir : x)) });
  }

  async function hapus() {
    if (!window.confirm('Hapus set soal ini?')) return;
    try {
      await api.delete(`/soal/${id}`);
      navigate('/soal');
    } catch (e) {
      setGalat(pesanError(e));
    }
  }

  return (
    <div>
      <Header
        judul={set.judul}
        deskripsi={`${set.mapel} · kelas ${set.kelas} · ${set.butir.length} soal`}
        aksi={
          <>
            <button type="button" onClick={() => setBukaBuat((v) => !v)} disabled={sibuk !== '' || !online} title={online ? undefined : 'Butuh internet'} className="btn-utama">
              {sibuk === 'form' ? 'Memproses...' : set.formUrl ? 'Buat ulang Google Form' : 'Buat Google Form'}
            </button>
            <button type="button" onClick={() => ekspor('kahoot')} disabled={sibuk !== '' || !online} title={online ? undefined : 'Butuh internet'} className="btn-garis">
              {sibuk === 'kahoot' ? 'Menyiapkan...' : 'Unduh untuk Kahoot'}
            </button>
            <button type="button" onClick={() => ekspor('word')} disabled={sibuk !== '' || !online} title={online ? undefined : 'Butuh internet'} className="btn-garis">
              {sibuk === 'word' ? 'Menyiapkan...' : 'Unduh Word'}
            </button>
            <button type="button" onClick={() => ekspor('lengkap')} disabled={sibuk !== '' || !online} title={online ? undefined : 'Butuh internet'} className="btn-garis">
              {sibuk === 'lengkap' ? 'Menyiapkan...' : 'Excel lengkap'}
            </button>
            <button type="button" onClick={hapus} disabled={!online} title={online ? undefined : 'Butuh internet'} className="btn-bahaya">
              Hapus
            </button>
          </>
        }
      />

      <div className="mb-4 space-y-3">
        {galat && <Pesan nada="galat">{galat}</Pesan>}
        {info && <Pesan nada="sukses">{info}</Pesan>}
        {sasaran > 0 && (
          <Pesan nada="info">
            Set remedial ini ditujukan untuk <b>{sasaran} siswa</b>
            {kelasSasaran ? ` kelas ${kelasSasaran.nama}` : ''} yang nilainya di bawah KKM. Google Form-nya hanya memuat nama mereka di dropdown.
          </Pesan>
        )}
        {jumlahRagu > 0 && (
          <Pesan nada="awas">
            <b>{jumlahRagu} soal perlu diperiksa.</b> AI mengerjakan ulang soal tanpa melihat kunci, dan jawabannya berbeda pada soal bertanda kuning.
            {set.formUrl ? '' : ' Periksa dan sunting dulu sebelum membuat Google Form.'}
          </Pesan>
        )}
        {bukaBuat && (
          <div className="kartu space-y-3 text-sm">
            <p className="font-semibold">{sasaran > 0 ? 'Form untuk siswa remedial' : 'Untuk kelas mana form ini?'}</p>
            {kelas.some((k) => k.jumlahSiswa > 0) ? (
              <>
                <p className="text-tinta-500">
                  Siswa akan memilih namanya dari dropdown{sasaran > 0 ? ` (hanya ${sasaran} siswa remedial)` : ' berisi daftar siswa kelas ini'}, tanpa
                  perlu mengetik, sehingga nilainya bisa langsung diimpor dengan benar.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[12rem]">
                    <label htmlFor="pilih-kelas" className="label">
                      Kelas
                    </label>
                    <select id="pilih-kelas" className="input" value={kelasPilih} disabled={sasaran > 0} onChange={(e) => setKelasPilih(e.target.value)}>
                      {kelas.filter((k) => k.jumlahSiswa > 0 && (!set.targetKelasId || k.id === set.targetKelasId)).map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama} · {sasaran > 0 ? sasaran : k.jumlahSiswa} siswa
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={buatForm} disabled={sibuk !== '' || !kelasPilih} className="btn-aksen">
                    {sibuk === 'form' ? 'Membuat form...' : 'Buat form sekarang'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-tinta-700">
                Belum ada kelas yang berisi siswa. <Link to="/kelas" className="underline">Buat kelas dan tambahkan siswa</Link> dulu, lalu kembali ke sini.
              </p>
            )}
          </div>
        )}
        {set.formUrl && (
          <div className="kartu space-y-2 text-sm">
            <p className="font-semibold">Google Form siap dibagikan</p>
            <p className="break-all">
              Tautan siswa:{' '}
              <a href={set.formUrl} target="_blank" rel="noreferrer" className="underline">
                {set.formUrl}
              </a>{' '}
              <button type="button" className="btn-garis ml-1 py-0.5 text-xs" onClick={() => navigator.clipboard.writeText(set.formUrl!).then(() => setInfo('Tautan disalin.'))}>
                Salin
              </button>
            </p>
            {set.formEditUrl && (
              <a href={set.formEditUrl} target="_blank" rel="noreferrer" className="underline">
                Buka di Google Forms
              </a>
            )}
            <p className="text-tinta-500">Siswa cukup memilih namanya dari dropdown di soal pertama, lalu menjawab. Ada siswa baru di kelas? Perbarui daftar nama di form.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setBukaImpor((v) => !v)} className="btn-aksen">
                {bukaImpor ? 'Tutup impor nilai' : 'Impor nilai & analisis soal'}
              </button>
              <button type="button" onClick={segarkanDaftar} disabled={sibuk !== ''} className="btn-garis">
                Perbarui daftar nama di form
              </button>
            </div>
          </div>
        )}
        {set.formUrl && bukaImpor && (
          <div className="kartu">
            <ImporNilai setId={set.id} mapel={set.mapel} namaKelas={kelas.find((k) => k.id === set.formKelasId)?.nama ?? ''} />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {set.butir.map((b) => (
          <KartuButir key={b.id} b={b} bisaUbah={!set.formUrl} onSimpan={simpanButir} />
        ))}
      </div>
      {set.formUrl && <p className="mt-4 text-xs text-tinta-500">Soal dikunci setelah dibuatkan Google Form agar isi form dan analisis tetap konsisten.</p>}
    </div>
  );
}
