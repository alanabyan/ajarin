import { HttpError } from '../lib/http';
import { Jenjang, KELAS_PER_JENJANG, MasalahIsian, kelasCocok, periksaKonflikJenjang } from '../utils/akademik';
import { periksaKonsistensi } from './ai';

const keKolom = (masalah: MasalahIsian[]) =>
  masalah.reduce<Record<string, string>>((acc, m) => {
    acc[m.bagian] = acc[m.bagian] ? `${acc[m.bagian]} ${m.pesan}` : m.pesan;
    return acc;
  }, {});

/**
 * Pemeriksaan isian sebelum AI membuat modul / soal, berlapis:
 * 1. Kelas harus termasuk jenjang yang dipilih (mis. SMK hanya X-XII). Pasti, tidak bisa dilewati.
 * 2. Teks bebas tidak boleh menyebut jenjang/kelas lain (judul "SD" tapi jenjang SMK). Pasti, tidak bisa dilewati.
 * 3. AI menilai kecocokan isian dengan mapel dan tingkat kelas, serta keselarasan judul/materi/TP. Karena AI bisa
 *    keliru, hasilnya berupa peringatan (kode PERINGATAN_AI) yang boleh diabaikan guru dengan `abaikanPeringatan`.
 */
export async function pastikanIsianSesuai(i: {
  jenis: 'modul' | 'soal';
  jenjang: Jenjang;
  kelas: string;
  mapel: string;
  kolom: Record<string, string | undefined>;
  label: Record<string, string>;
  abaikanPeringatan?: boolean;
}): Promise<void> {
  if (!kelasCocok(i.jenjang, i.kelas)) {
    const pilihan = KELAS_PER_JENJANG[i.jenjang].join(', ');
    throw new HttpError(400, `Kelas ${i.kelas} tidak ada di jenjang ${i.jenjang}. Pilih salah satu: ${pilihan}.`, {
      kolom: { kelas: `Untuk ${i.jenjang}, pilih kelas ${pilihan}.` },
    });
  }

  const konflik = periksaKonflikJenjang({ ...i.kolom, mapel: i.mapel }, { ...i.label, mapel: 'Mata pelajaran' }, i.jenjang, i.kelas);
  if (konflik.length) {
    throw new HttpError(422, 'Isian tidak sesuai dengan jenjang/kelas yang dipilih. Samakan dulu sebelum melanjutkan.', {
      kolom: keKolom(konflik),
    });
  }

  if (i.abaikanPeringatan) return;
  const kolom = Object.fromEntries(Object.entries(i.kolom).filter((e): e is [string, string] => !!e[1]));
  const masalah = await periksaKonsistensi({ jenis: i.jenis, jenjang: i.jenjang, kelas: i.kelas, mapel: i.mapel, kolom, label: i.label });
  if (masalah.length) {
    throw new HttpError(422, 'AI menemukan isian yang tampaknya tidak sesuai. Perbaiki isian yang ditandai, atau lanjutkan bila Anda yakin sudah benar.', {
      kode: 'PERINGATAN_AI',
      kolom: keKolom(masalah),
    });
  }
}
