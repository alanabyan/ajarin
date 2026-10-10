// Membaca daftar siswa dari berkas Excel (.xlsx) atau CSV. Kolom dikenali dari judulnya (Nama, NIS / NISN);
// tanpa baris judul, kolom pertama dianggap nama dan kolom kedua NIS.

export interface SiswaBaru {
  nama: string;
  nis: string;
}

export interface HasilBerkas {
  siswa: SiswaBaru[];
  /** Baris berisi tetapi nama atau NIS-nya kosong. */
  dilewati: number;
}

export const MAKS_UKURAN_BERKAS = 2 * 1024 * 1024;
export const MAKS_BARIS_BERKAS = 1000;

const POLA_NAMA = /^(nama|nama\s*(lengkap|siswa|peserta\s*didik))$/i;
const POLA_NIS = /^(nis|nisn|nis\/nisn|no\.?\s*induk|nomor\s*induk(\s*siswa)?)$/i;

const sel = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return '';
  return String(v).replace(/\s+/g, ' ').trim();
};

/** Teks CSV -> baris. Mendukung tanda kutip ganda dan pemisah koma / titik koma / tab (dipilih dari baris pertama). */
export function parseCsv(teks: string): string[][] {
  const bersih = teks.replace(/^﻿/, '');
  const barisPertama = bersih.split(/\r?\n/, 1)[0] ?? '';
  const hitung = (c: string) => barisPertama.split(c).length - 1;
  const pemisah = [';', '\t', ','].reduce((a, c) => (hitung(c) > hitung(a) ? c : a), ',');

  const hasil: string[][] = [];
  let baris: string[] = [];
  let isi = '';
  let kutip = false;
  for (let i = 0; i < bersih.length; i++) {
    const ch = bersih[i];
    if (kutip) {
      if (ch === '"' && bersih[i + 1] === '"') {
        isi += '"';
        i++;
      } else if (ch === '"') kutip = false;
      else isi += ch;
    } else if (ch === '"') kutip = true;
    else if (ch === pemisah) {
      baris.push(isi);
      isi = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && bersih[i + 1] === '\n') i++;
      baris.push(isi);
      hasil.push(baris);
      baris = [];
      isi = '';
    } else isi += ch;
  }
  if (isi || baris.length) {
    baris.push(isi);
    hasil.push(baris);
  }
  return hasil;
}

/** Baris mentah (dari Excel / CSV) -> daftar siswa. */
export function barisKeSiswa(mentah: unknown[][]): HasilBerkas {
  const baris = mentah.map((b) => b.map(sel)).filter((b) => b.some(Boolean));
  if (baris.length === 0) return { siswa: [], dilewati: 0 };

  let kolomNama = 0;
  let kolomNis = 1;
  let mulai = 0;

  const iNama = baris[0].findIndex((c) => POLA_NAMA.test(c));
  const iNis = baris[0].findIndex((c) => POLA_NIS.test(c));
  if (iNama >= 0 && iNis >= 0) {
    kolomNama = iNama;
    kolomNis = iNis;
    mulai = 1;
  } else if (/^\d+$/.test(baris[0][0] ?? '') && baris[0][1] && !/^\d+$/.test(baris[0][1])) {
    // tanpa judul, tetapi urutannya "NIS, Nama"
    kolomNama = 1;
    kolomNis = 0;
  }

  const siswa: SiswaBaru[] = [];
  let dilewati = 0;
  for (const b of baris.slice(mulai)) {
    const nama = b[kolomNama] ?? '';
    const nis = b[kolomNis] ?? '';
    if (nama.length >= 2 && nis) siswa.push({ nama: nama.slice(0, 100), nis: nis.slice(0, 30) });
    else dilewati++;
  }
  return { siswa, dilewati };
}

export async function bacaBerkasSiswa(berkas: File): Promise<HasilBerkas> {
  if (berkas.size > MAKS_UKURAN_BERKAS) throw new Error('Berkas terlalu besar (maksimal 2 MB).');
  const nama = berkas.name.toLowerCase();

  let mentah: unknown[][];
  if (nama.endsWith('.xlsx')) {
    const { default: bacaXlsx } = await import('read-excel-file');
    try {
      mentah = (await bacaXlsx(berkas)) as unknown[][];
    } catch {
      throw new Error('Berkas Excel tidak bisa dibaca. Pastikan formatnya .xlsx dan tidak dilindungi kata sandi.');
    }
  } else if (nama.endsWith('.csv') || nama.endsWith('.txt') || nama.endsWith('.tsv')) {
    mentah = parseCsv(await berkas.text());
  } else if (nama.endsWith('.xls')) {
    throw new Error('Format .xls lama tidak didukung. Simpan ulang sebagai .xlsx atau .csv di Excel.');
  } else {
    throw new Error('Pilih berkas .xlsx atau .csv.');
  }

  const hasil = barisKeSiswa(mentah);
  if (hasil.siswa.length === 0) {
    throw new Error('Tidak ada siswa yang terbaca. Pastikan ada kolom Nama dan NIS (judul kolom di baris pertama).');
  }
  if (hasil.siswa.length > MAKS_BARIS_BERKAS) {
    throw new Error(`Terlalu banyak baris (${hasil.siswa.length}). Maksimal ${MAKS_BARIS_BERKAS} siswa per berkas.`);
  }
  return hasil;
}

/** Templat CSV (dengan BOM agar Excel membaca UTF-8 dengan benar). */
export function unduhTemplatSiswa() {
  const isi = '﻿Nama,NIS\r\nAhmad Fauzan,2026001\r\nBunga Citra,2026002\r\n';
  const href = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = 'templat-siswa.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
