import { Response } from 'express';
import { HttpError } from './http';

/**
 * AbortController yang otomatis dibatalkan bila klien memutus koneksi sebelum respons selesai.
 * Buat SEBELUM memanggil AI, lalu berikan `signal`-nya ke permintaan AI.
 */
export function putusBilaKlienPergi(res: Response): AbortController {
  const putus = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) putus.abort();
  });
  return putus;
}

/**
 * Menyalurkan aliran teks ke klien sebagai baris JSON (NDJSON):
 *   {"t":"potongan"} ... lalu {"id":"..."} bila berhasil disimpan, atau {"error":"..."} bila gagal.
 *
 * `putus` (dari putusBilaKlienPergi) harus sudah dipakai untuk membuat `aliran`: bila klien memutus koneksi di tengah jalan, `putus` dibatalkan
 * (menghentikan permintaan ke AI) dan `simpan` tidak dipanggil, jadi tidak ada dokumen setengah jadi yang tersimpan.
 * Pemanggil bertanggung jawab atas galat SEBELUM fungsi ini dipanggil (validasi, kuota, AI tidak bisa dihubungi);
 * itu tetap menjadi respons JSON biasa karena header streaming belum terkirim.
 */
export async function alirkanNdjson(
  res: Response,
  putus: AbortController,
  aliran: AsyncIterable<string>,
  simpan: (teks: string) => Promise<{ id: string }>
): Promise<void> {
  res.status(200).set({
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const kirim = (o: object) => res.write(`${JSON.stringify(o)}\n`);

  try {
    let teks = '';
    for await (const t of aliran) {
      if (putus.signal.aborted) break; // keluar dari loop menutup aliran (generator.return)
      teks += t;
      kirim({ t });
    }
    if (putus.signal.aborted) return;
    teks = teks.trim();
    if (!teks) throw new HttpError(502, 'AI tidak mengembalikan jawaban. Coba lagi.');
    kirim({ id: (await simpan(teks)).id });
  } catch (err) {
    if (putus.signal.aborted) return; // klien sudah pergi; tidak ada yang perlu dikirim
    if (!(err instanceof HttpError)) console.error(err);
    kirim({ error: err instanceof HttpError ? err.message : 'Terjadi kesalahan pada server.' });
  } finally {
    res.end();
  }
}
