import { useMemo, useRef, useState } from 'react';
import client from '../api/client';

interface SiswaAda {
  nama: string;
  nis: string;
}

interface Baris {
  kid: number;
  nama: string;
  nis: string;
  pilih: boolean;
}

interface Props {
  kelasId: string;
  siswaAda: SiswaAda[];
  /** Dipanggil setelah siswa tersimpan (untuk memuat ulang data). */
  onSelesai: (teks: string) => void | Promise<void>;
  onError: (teks: string) => void;
}

// Kunci pembanding duplikat: NIS jika ada, kalau tidak nama (sama seperti di backend).
function kunci(nama: string, nis: string): string {
  const n = nis.trim().toLowerCase();
  return n && n !== '-' ? `nis:${n}` : `nama:${nama.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function pesanError(err: any): string {
  return err?.response?.data?.error || err?.message || 'Terjadi kesalahan. Coba lagi.';
}

// Memperkecil foto (sisi terpanjang <= 2000px) dan mengubahnya ke JPEG supaya muat dalam batas unggah.
async function perkecilGambar(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Format gambar tidak didukung. Gunakan foto JPG atau PNG.');
  }

  for (const sisiMaks of [2000, 1600, 1200]) {
    const skala = Math.min(1, sisiMaks / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * skala);
    canvas.height = Math.round(bitmap.height * skala);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gagal memproses gambar.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (blob && blob.size <= 2.8 * 1024 * 1024) return blob;
  }
  throw new Error('Foto terlalu besar. Coba foto dengan resolusi lebih kecil.');
}

export default function ImporSiswa({ kelasId, siswaAda, onSelesai, onError }: Props) {
  const inputTabel = useRef<HTMLInputElement>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const kidBerikut = useRef(1);

  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [sumber, setSumber] = useState<'excel' | 'csv' | 'foto' | null>(null);
  const [peringatan, setPeringatan] = useState<string[]>([]);
  const [memproses, setMemproses] = useState<'tabel' | 'foto' | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  async function bacaFile(file: File, jenis: 'tabel' | 'foto') {
    setMemproses(jenis);
    try {
      const form = new FormData();
      if (jenis === 'foto') {
        form.append('file', await perkecilGambar(file), 'foto.jpg');
      } else {
        form.append('file', file);
      }
      const res = await client.post('/siswa/import/parse', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const hasil: { siswa: { nama: string; nis: string }[]; peringatan: string[]; sumber: 'excel' | 'csv' | 'foto' } =
        res.data;
      if (hasil.siswa.length === 0) {
        onError(
          jenis === 'foto'
            ? 'Tidak ada nama siswa yang terbaca dari foto. Coba foto yang lebih jelas dan lurus.'
            : 'Tidak ada data siswa yang terbaca. Pastikan ada kolom "Nama" (dan "NIS"), atau gunakan template.'
        );
        return;
      }
      setBaris(hasil.siswa.map((s) => ({ kid: kidBerikut.current++, nama: s.nama, nis: s.nis, pilih: true })));
      setPeringatan(hasil.peringatan);
      setSumber(hasil.sumber);
    } catch (err) {
      onError(pesanError(err));
    } finally {
      setMemproses(null);
    }
  }

  async function unduhTemplate() {
    try {
      const res = await client.get('/siswa/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-siswa.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      onError(pesanError(err));
    }
  }

  // Tandai baris yang sudah ada di kelas atau kembar di dalam daftar.
  const status = useMemo(() => {
    const ada = new Set(siswaAda.map((s) => kunci(s.nama, s.nis)));
    const dilihat = new Set<string>();
    const hasil = new Map<number, 'ok' | 'sudah-ada' | 'kembar' | 'nama-kosong'>();
    (baris ?? []).forEach((b) => {
      if (b.nama.trim().length < 2) return hasil.set(b.kid, 'nama-kosong');
      const k = kunci(b.nama, b.nis);
      if (ada.has(k)) return hasil.set(b.kid, 'sudah-ada');
      if (dilihat.has(k)) return hasil.set(b.kid, 'kembar');
      dilihat.add(k);
      hasil.set(b.kid, 'ok');
    });
    return hasil;
  }, [baris, siswaAda]);

  const akanDisimpan = (baris ?? []).filter((b) => b.pilih && status.get(b.kid) === 'ok');

  function ubah(kid: number, perubahan: Partial<Baris>) {
    setBaris((lama) => (lama ?? []).map((b) => (b.kid === kid ? { ...b, ...perubahan } : b)));
  }

  function tutup() {
    setBaris(null);
    setSumber(null);
    setPeringatan([]);
  }

  async function simpan() {
    if (akanDisimpan.length === 0) return;
    setMenyimpan(true);
    try {
      const res = await client.post('/siswa/bulk', {
        kelasId,
        siswa: akanDisimpan.map((b) => ({ nama: b.nama.trim(), nis: b.nis.trim() })),
      });
      const { dibuat, dilewati } = res.data as { dibuat: number; dilewati: unknown[] };
      tutup();
      await onSelesai(`${dibuat} siswa ditambahkan${dilewati.length > 0 ? `, ${dilewati.length} dilewati (sudah ada)` : ''}.`);
    } catch (err) {
      onError(pesanError(err));
    } finally {
      setMenyimpan(false);
    }
  }

  const labelStatus = (s: string | undefined) => {
    if (s === 'sudah-ada') return <span className="text-xs text-ink/50">Sudah ada di kelas</span>;
    if (s === 'kembar') return <span className="text-xs text-amber-600">Kembar di daftar</span>;
    if (s === 'nama-kosong') return <span className="text-xs text-red-600">Nama terlalu pendek</span>;
    return null;
  };

  return (
    <div className="bg-white rounded-lg border border-ink/10 p-4 space-y-3">
      <div>
        <p className="font-medium">Tambah banyak siswa sekaligus</p>
        <p className="text-sm text-ink/60">
          Unggah daftar dari Excel atau foto/scan daftar kelas. Hasilnya tampil dulu sebagai pratinjau untuk Anda periksa
          sebelum disimpan.
        </p>
      </div>

      {!baris && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputTabel.current?.click()}
              disabled={memproses !== null}
              className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900 disabled:opacity-50"
            >
              {memproses === 'tabel' ? 'Membaca file...' : 'Unggah Excel / CSV'}
            </button>
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              disabled={memproses !== null}
              className="rounded-md border border-forest-700 text-forest-700 text-sm px-4 py-2 hover:bg-forest-50 disabled:opacity-50"
            >
              {memproses === 'foto' ? 'AI sedang membaca foto...' : 'Foto / scan daftar'}
            </button>
            <button
              type="button"
              onClick={unduhTemplate}
              className="rounded-md text-sm px-3 py-2 text-forest-700 hover:underline"
            >
              Unduh template Excel
            </button>
          </div>

          <input
            ref={inputTabel}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) bacaFile(f, 'tabel');
            }}
          />
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) bacaFile(f, 'foto');
            }}
          />

          <p className="text-xs text-ink/50">
            Excel/CSV: butuh kolom <b>Nama</b> dan (sebaiknya) <b>NIS</b>. Foto: pastikan tulisan jelas, lurus, dan cukup
            terang; foto dikirim ke layanan AI untuk dibaca, jadi hindari memfoto data selain daftar nama dan NIS.
          </p>
        </>
      )}

      {baris && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Pratinjau dari {sumber === 'foto' ? 'foto' : sumber === 'csv' ? 'file CSV' : 'file Excel'} · {baris.length} baris
          </p>

          {peringatan.length > 0 && (
            <ul className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 space-y-1 list-disc list-inside">
              {peringatan.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}

          <div className="border border-ink/10 rounded-md overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-ink/60 text-left sticky top-0">
                <tr>
                  <th className="px-3 py-2 w-10" />
                  <th className="px-3 py-2 font-medium">Nama</th>
                  <th className="px-3 py-2 font-medium w-40">NIS</th>
                  <th className="px-3 py-2 font-medium w-40" />
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => {
                  const s = status.get(b.kid);
                  const nonaktif = s !== 'ok';
                  return (
                    <tr key={b.kid} className={`border-t border-ink/10 ${nonaktif ? 'bg-paper/60' : ''}`}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={b.pilih && s === 'ok'}
                          disabled={s !== 'ok'}
                          onChange={(e) => ubah(b.kid, { pilih: e.target.checked })}
                          aria-label={`Pilih ${b.nama}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={b.nama}
                          onChange={(e) => ubah(b.kid, { nama: e.target.value })}
                          className="input !py-1"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={b.nis}
                          placeholder="(kosong)"
                          onChange={(e) => ubah(b.kid, { nis: e.target.value })}
                          className="input !py-1"
                        />
                      </td>
                      <td className="px-3 py-1.5">{labelStatus(s)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => setBaris((lama) => (lama ?? []).filter((x) => x.kid !== b.kid))}
                          className="text-ink/40 hover:text-red-600"
                          aria-label={`Buang ${b.nama}`}
                          title="Buang baris ini"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink/60">{akanDisimpan.length} siswa akan ditambahkan</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={tutup}
                disabled={menyimpan}
                className="rounded-md border border-ink/20 text-sm px-4 py-2 hover:bg-paper disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={simpan}
                disabled={akanDisimpan.length === 0 || menyimpan}
                className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-900 disabled:opacity-40"
              >
                {menyimpan ? 'Menyimpan...' : `Simpan ${akanDisimpan.length} siswa`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
