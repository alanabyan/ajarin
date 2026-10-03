import { ChangeEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './modul.css';
import { ModulAjar } from '../types';

// Pratinjau dokumen + cover, lalu "Cetak / Simpan PDF" lewat dialog cetak browser.
// Hasil cetak memakai tampilan yang sama dengan yang terlihat di layar ini (termasuk rumus dan tabel).

interface Props {
  modul: ModulAjar;
  /** Markdown saat ini (boleh yang belum disimpan). */
  konten: string;
  onTutup: () => void;
}

type Tema = 'hijau' | 'biru' | 'ungu' | 'jingga' | 'marun';

const TEMA: { id: Tema; label: string; warna: string }[] = [
  { id: 'hijau', label: 'Hijau', warna: '#2e7d5a' },
  { id: 'biru', label: 'Biru', warna: '#2f6fb3' },
  { id: 'ungu', label: 'Ungu', warna: '#7c4dbd' },
  { id: 'jingga', label: 'Jingga', warna: '#e07b2c' },
  { id: 'marun', label: 'Marun', warna: '#b03a5e' },
];

// Izinkan <br> dan HTML aman di dalam Markdown (sering dipakai AI di sel tabel), buang yang berbahaya.
const skemaAman = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className', 'language-math', 'math-inline', 'math-display']],
  },
};

const KUNCI = 'cover-modul-v1';

interface PengaturanCover {
  sertakan: boolean;
  tema: Tema;
  penyusun: string;
  sekolah: string;
  tahun: string;
  gambar: string | null;
}

function tahunAjaranSekarang(): string {
  const d = new Date();
  const y = d.getFullYear();
  return d.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

function bacaPengaturan(): PengaturanCover {
  const dasar: PengaturanCover = {
    sertakan: true,
    tema: 'hijau',
    penyusun: '',
    sekolah: '',
    tahun: tahunAjaranSekarang(),
    gambar: null,
  };
  try {
    const mentah = localStorage.getItem(KUNCI);
    if (mentah) return { ...dasar, ...JSON.parse(mentah) };
  } catch {
    /* abaikan */
  }
  return dasar;
}

// Perkecil gambar cover (sisi terpanjang <= 1600px) agar ringan.
async function perkecilGambar(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Format gambar tidak didukung. Gunakan JPG atau PNG.');
  }
  const skala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * skala);
  canvas.height = Math.round(bitmap.height * skala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal memproses gambar.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function ModulPdfPreview({ modul, konten, onTutup }: Props) {
  const [p, setP] = useState<PengaturanCover>(bacaPengaturan);
  const [judul, setJudul] = useState(modul.judul);
  const [subjudul, setSubjudul] = useState(modul.topik);
  const [galat, setGalat] = useState<string | null>(null);

  // Simpan pengaturan cover (gambar hanya jika cukup kecil untuk localStorage).
  useEffect(() => {
    try {
      const simpanGambar = p.gambar && p.gambar.length < 900_000 ? p.gambar : null;
      localStorage.setItem(KUNCI, JSON.stringify({ ...p, gambar: simpanGambar }));
    } catch {
      /* abaikan */
    }
  }, [p]);

  // Nama file PDF yang disarankan browser = judul dokumen.
  useEffect(() => {
    const lama = document.title;
    document.title = `${modul.judul} - Modul Ajar`;
    return () => {
      document.title = lama;
    };
  }, [modul.judul]);

  useEffect(() => {
    const tutupDenganEsc = (e: KeyboardEvent) => e.key === 'Escape' && onTutup();
    window.addEventListener('keydown', tutupDenganEsc);
    return () => window.removeEventListener('keydown', tutupDenganEsc);
  }, [onTutup]);

  async function pilihGambar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setGalat(null);
    try {
      setP((lama) => ({ ...lama, gambar: null }));
      const data = await perkecilGambar(file);
      setP((lama) => ({ ...lama, gambar: data }));
    } catch (err: any) {
      setGalat(err?.message || 'Gagal membaca gambar.');
    }
  }

  const info: [string, string][] = [
    ['Kelas', modul.kelas],
    ['Alokasi waktu', modul.alokasiWaktu],
    ['Tahun pelajaran', p.tahun],
    ['Penyusun', p.penyusun],
    ['Satuan pendidikan', p.sekolah],
  ];

  const ubah = <K extends keyof PengaturanCover>(k: K, v: PengaturanCover[K]) => setP((lama) => ({ ...lama, [k]: v }));

  const label = 'block text-sm text-ink/70 mb-1';

  return createPortal(
    <div className="pratinjau-cetak fixed inset-0 z-[100] flex flex-col lg:flex-row bg-neutral-200 overflow-hidden">
      {/* ===== Panel kontrol (tidak ikut tercetak) ===== */}
      <aside className="pratinjau-kontrol w-full lg:w-80 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-ink/10 overflow-y-auto p-4 space-y-4 max-h-[45vh] lg:max-h-none">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Unduh PDF</h2>
          <button onClick={onTutup} className="text-sm text-ink/60 hover:text-ink">
            Tutup ✕
          </button>
        </div>

        <button
          onClick={() => window.print()}
          className="w-full rounded-md bg-forest-700 text-white text-sm py-2.5 hover:bg-forest-900"
        >
          Cetak / Simpan sebagai PDF
        </button>
        <p className="text-xs text-ink/60 leading-relaxed">
          Di jendela yang muncul: pilih tujuan <b>Simpan sebagai PDF</b>, ukuran <b>A4</b>, dan matikan{' '}
          <b>Header dan footer</b> agar hasilnya bersih.
        </p>

        <hr className="border-ink/10" />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.sertakan} onChange={(e) => ubah('sertakan', e.target.checked)} />
          Sertakan halaman cover
        </label>

        {p.sertakan && (
          <div className="space-y-3">
            <div>
              <span className={label}>Gambar cover</span>
              <div className="flex items-center gap-2">
                <label className="rounded-md border border-forest-700 text-forest-700 text-sm px-3 py-1.5 hover:bg-forest-50 cursor-pointer">
                  {p.gambar ? 'Ganti gambar' : 'Unggah gambar'}
                  <input type="file" accept="image/*" className="hidden" onChange={pilihGambar} />
                </label>
                {p.gambar && (
                  <button onClick={() => ubah('gambar', null)} className="text-sm text-red-600 hover:underline">
                    Hapus
                  </button>
                )}
              </div>
              <p className="text-xs text-ink/50 mt-1">
                Opsional: logo sekolah atau ilustrasi (JPG/PNG). Tanpa gambar, cover memakai hiasan warna.
              </p>
              {galat && <p className="text-xs text-red-600 mt-1">{galat}</p>}
            </div>

            <div>
              <span className={label}>Warna tema</span>
              <div className="flex gap-2">
                {TEMA.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => ubah('tema', t.id)}
                    title={t.label}
                    aria-label={`Tema ${t.label}`}
                    aria-pressed={p.tema === t.id}
                    style={{ background: t.warna }}
                    className={`w-7 h-7 rounded-full ${p.tema === t.id ? 'ring-2 ring-offset-2 ring-ink/60' : ''}`}
                  />
                ))}
              </div>
            </div>

            <label className="block">
              <span className={label}>Judul di cover</span>
              <input value={judul} onChange={(e) => setJudul(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className={label}>Subjudul (mata pelajaran / topik)</span>
              <input value={subjudul} onChange={(e) => setSubjudul(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className={label}>Nama penyusun</span>
              <input value={p.penyusun} onChange={(e) => ubah('penyusun', e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className={label}>Satuan pendidikan</span>
              <input
                value={p.sekolah}
                onChange={(e) => ubah('sekolah', e.target.value)}
                placeholder="contoh: SMP Negeri 1 ..."
                className="input"
              />
            </label>
            <label className="block">
              <span className={label}>Tahun pelajaran</span>
              <input value={p.tahun} onChange={(e) => ubah('tahun', e.target.value)} className="input" />
            </label>
          </div>
        )}
      </aside>

      {/* ===== Lembar pratinjau ===== */}
      <div className="pratinjau-gulir flex-1 overflow-auto p-4 lg:p-8">
        {p.sertakan && (
          <section className={`lembar lembar-cover tema-${p.tema}`} aria-label="Halaman cover">
            <div className="cover-atas">
              {p.gambar ? <img src={p.gambar} alt="" /> : <div className="cover-hias" />}
              <div className="cover-gelombang" />
            </div>
            <div className="cover-pita" />
            <div className="cover-badan">
              <p className="cover-label">MODUL AJAR</p>
              <h1 className="cover-judul">{judul || 'Modul Ajar'}</h1>
              {subjudul && <p className="cover-sub">{subjudul}</p>}
              <div className="cover-garis" />
              <dl className="cover-info">
                {info
                  .filter(([, v]) => v && v.trim() !== '')
                  .map(([k, v]) => (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
              <p className="cover-kaki">Kurikulum Merdeka</p>
            </div>
          </section>
        )}

        <section className="lembar lembar-isi" aria-label="Isi modul">
          <div className="isi-modul">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, skemaAman], rehypeKatex]}
            >
              {konten}
            </ReactMarkdown>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
