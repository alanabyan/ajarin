import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';

const BAGIAN: [string, string][] = [
  [
    'Data yang kami simpan',
    'Akun guru (nama, email, jenjang, mata pelajaran, sekolah), modul ajar dan soal yang Anda buat, serta data kelas, siswa (nama dan NIS), dan nilai yang Anda masukkan sendiri. Kata sandi disimpan dalam bentuk hash, bukan teks asli.',
  ],
  [
    'Penggunaan layanan AI',
    'Topik, tujuan pembelajaran, dan materi yang Anda isi dikirim ke penyedia layanan AI untuk menyusun modul dan soal. Data siswa tidak pernah dikirim ke layanan AI.',
  ],
  [
    'Integrasi Google Forms',
    'Saat Anda menghubungkan akun Google, kami meminta izin untuk membuat kuis dan membaca jawabannya (forms.body dan forms.responses.readonly), serta opsional untuk membuka akses form (drive.file). Token akses dipakai satu kali pada permintaan itu dan tidak disimpan. Kami hanya menyimpan id dan tautan form.',
  ],
  [
    'Data siswa',
    'Data siswa adalah data pribadi anak. Masukkan seperlunya (nama dan NIS), gunakan hanya untuk keperluan pembelajaran di kelas Anda, dan hapus bila tidak lagi dibutuhkan. Anda dapat menghapus siswa, kelas, dan seluruh nilainya kapan saja dari aplikasi.',
  ],
  [
    'Akun demo',
    'Akun demo dipakai bersama oleh banyak pengunjung dan berisi data contoh. Jangan memasukkan data asli ke akun demo.',
  ],
  ['Kontak', 'Pertanyaan terkait privasi dapat disampaikan melalui pengelola Ajarin.'],
];

export default function Privasi() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Logo />
      <h1 className="mt-6 text-3xl font-semibold">Kebijakan Privasi</h1>
      <p className="mt-1 text-tinta-500">Berlaku sejak Oktober 2026.</p>
      <div className="mt-8 space-y-6">
        {BAGIAN.map(([judul, isi]) => (
          <section key={judul}>
            <h2 className="text-xl font-semibold">{judul}</h2>
            <p className="mt-1 leading-relaxed text-tinta-700">{isi}</p>
          </section>
        ))}
      </div>
      <Link to="/" className="btn-garis mt-10">
        Kembali ke beranda
      </Link>
    </div>
  );
}
