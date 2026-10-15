import { FormEvent, useState } from 'react';
import { Header, Kolom, Pesan, TombolKembali, propsKontrol } from '../components/ui';
import { kolomError, pesanError } from '../lib/api';
import { BATAS_AKUN, galatNama, galatSekolah } from '../lib/akun';
import { useAuth } from '../lib/auth';
import { useJaringan } from '../lib/offline/jaringan';

/** Profil akun: nama dan nama sekolah bisa diubah; email tetap karena dipakai untuk masuk. */
export default function Profil() {
  const { user, perbaruiProfil } = useAuth();
  const { online } = useJaringan();
  const [nama, setNama] = useState(user?.nama ?? '');
  const [sekolah, setSekolah] = useState(user?.sekolah ?? '');
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const berubah = nama.trim() !== (user?.nama ?? '') || sekolah.trim() !== (user?.sekolah ?? '');

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setGalat('');
    setInfo('');
    const g: Record<string, string> = {};
    const gNama = galatNama(nama);
    const gSekolah = galatSekolah(sekolah);
    if (gNama) g.nama = gNama;
    if (gSekolah) g.sekolah = gSekolah;
    setKolom(g);
    if (Object.keys(g).length) return;
    setSibuk(true);
    try {
      await perbaruiProfil({ nama: nama.trim(), sekolah: sekolah.trim() });
      setNama(nama.trim());
      setSekolah(sekolah.trim());
      setInfo('Profil disimpan.');
    } catch (err) {
      setKolom(kolomError(err));
      setGalat(pesanError(err, 'Gagal menyimpan profil.'));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <TombolKembali ke="/dashboard" label="Kembali ke Beranda" />
      <Header judul="Profil Saya" deskripsi="Nama dan sekolah Anda dipakai di identitas modul ajar yang disusun AI." />
      {!user?.sekolah && (
        <div className="mb-4">
          <Pesan nada="info">Nama sekolah belum diisi. Lengkapi supaya identitas modul ajar Anda terisi otomatis.</Pesan>
        </div>
      )}
      <form onSubmit={simpan} noValidate className="kartu space-y-4">
        <Kolom id="email" label="Email" petunjuk="Email dipakai untuk masuk dan tidak bisa diubah.">
          <input {...propsKontrol('email', undefined, true)} value={user?.email ?? ''} readOnly disabled className="input bg-tinta-50 text-tinta-500" />
        </Kolom>
        <Kolom id="nama" label="Nama lengkap" galat={kolom.nama} petunjuk={`${nama.length}/${BATAS_AKUN.nama} karakter.`}>
          <input
            {...propsKontrol('nama', kolom.nama, true)}
            autoComplete="name"
            maxLength={BATAS_AKUN.nama}
            value={nama}
            onChange={(e) => {
              setNama(e.target.value);
              setInfo('');
            }}
          />
        </Kolom>
        <Kolom
          id="sekolah"
          label="Nama sekolah (opsional)"
          galat={kolom.sekolah}
          petunjuk={`${sekolah.length}/${BATAS_AKUN.sekolah} karakter. Kosongkan bila tidak ingin dicantumkan.`}
        >
          <input
            {...propsKontrol('sekolah', kolom.sekolah, true)}
            maxLength={BATAS_AKUN.sekolah}
            placeholder="mis. SMK Negeri 1 Contoh"
            value={sekolah}
            onChange={(e) => {
              setSekolah(e.target.value);
              setInfo('');
            }}
          />
        </Kolom>
        {galat && <Pesan nada="galat">{galat}</Pesan>}
        {info && <Pesan nada="sukses">{info}</Pesan>}
        <button type="submit" disabled={sibuk || !berubah || !online} className="btn-utama">
          {sibuk ? 'Menyimpan...' : 'Simpan profil'}
        </button>
        {!online && <Pesan nada="awas">Anda sedang offline. Menyimpan profil butuh internet.</Pesan>}
      </form>
    </div>
  );
}
