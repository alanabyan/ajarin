import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { alirGroq, periksaKonsistensi, saranModul, tandaiKunciRagu, teksDariBarisSse } from './ai';

const asli = globalThis.fetch;
beforeEach(() => {
  process.env.GROQ_API_KEY = 'kunci-uji';
});
afterEach(() => {
  globalThis.fetch = asli;
});

const soal = (kunciIndex: number) => ({
  pertanyaan: 'Berapa 2 + 3?',
  pilihan: ['4', '5', '6', '7'],
  kunciIndex,
  pembahasan: '2 + 3 = 5',
});

const balasJson = (isi: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(isi) } }] }), { status: 200 });

test('teksDariBarisSse mengambil isi delta dan mengabaikan baris lain', () => {
  assert.equal(teksDariBarisSse('data: {"choices":[{"delta":{"content":"Halo"}}]}'), 'Halo');
  assert.equal(teksDariBarisSse('data: [DONE]'), '');
  assert.equal(teksDariBarisSse(': keep-alive'), '');
  assert.equal(teksDariBarisSse(''), '');
  assert.equal(teksDariBarisSse('data: {rusak'), '');
  assert.equal(teksDariBarisSse('data: {"choices":[{"delta":{}}]}'), '');
});

test('tandaiKunciRagu menandai soal yang jawabannya berbeda dari kunci', async () => {
  globalThis.fetch = async () => balasJson({ hasil: [{ no: 1, jawaban: 'B' }, { no: 2, jawaban: 'A' }] });
  // soal 1: kunci B (indeks 1) cocok; soal 2: kunci C (indeks 2) tapi AI menjawab A
  const hasil = await tandaiKunciRagu([soal(1), soal(2)]);
  assert.deepEqual(hasil, [false, true]);
});

test('tandaiKunciRagu menerima jawaban berformat "B." atau huruf kecil, dan mengabaikan nomor yang hilang', async () => {
  globalThis.fetch = async () => balasJson({ hasil: [{ no: 1, jawaban: 'b.' }] });
  assert.deepEqual(await tandaiKunciRagu([soal(1), soal(0)]), [false, false]);
});

test('tandaiKunciRagu tidak menandai apa pun bila verifikasi gagal', async () => {
  globalThis.fetch = async () => new Response('galat', { status: 500 });
  assert.deepEqual(await tandaiKunciRagu([soal(0), soal(1)]), [false, false]);

  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'bukan json' } }] }), { status: 200 });
  assert.deepEqual(await tandaiKunciRagu([soal(0)]), [false]);
});

function aliranSse(potongan: string[]): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        potongan.forEach((p) => c.enqueue(enc.encode(p)));
        c.close();
      },
    }),
    { status: 200 }
  );
}

test('alirGroq merangkai potongan teks walau baris SSE terbelah di tengah', async () => {
  const baris = (t: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`;
  const semua = baris('Ha') + baris('lo ') + baris('dunia') + 'data: [DONE]\n\n';
  globalThis.fetch = async () => aliranSse([semua.slice(0, 17), semua.slice(17, 60), semua.slice(60)]);

  let teks = '';
  for await (const t of await alirGroq('s', 'u', new AbortController().signal)) teks += t;
  assert.equal(teks, 'Halo dunia');
});

test('alirGroq melempar galat sebelum streaming bila Groq menolak', async () => {
  globalThis.fetch = async () => new Response('limit', { status: 429 });
  await assert.rejects(() => alirGroq('s', 'u', new AbortController().signal), /Layanan AI sedang bermasalah/);
});

const isianModul = {
  jenis: 'modul' as const,
  jenjang: 'SD',
  kelas: 'II',
  mapel: 'Matematika',
  kolom: { judul: 'Turunan Fungsi', topik: 'turunan', tujuanPembelajaran: 'Menghitung turunan fungsi aljabar' },
  label: { judul: 'Judul modul', topik: 'Cakupan materi', tujuanPembelajaran: 'Tujuan pembelajaran' },
};

test('periksaKonsistensi mengembalikan masalah hanya untuk kolom yang dikenal', async () => {
  globalThis.fetch = async () =>
    balasJson({
      masalah: [
        { bagian: 'topik', pesan: 'Turunan terlalu tinggi untuk SD kelas II.' },
        { bagian: 'kolomAsing', pesan: 'diabaikan' },
        { bagian: 'judul', pesan: '' },
      ],
    });
  assert.deepEqual(await periksaKonsistensi(isianModul), [{ bagian: 'topik', pesan: 'Turunan terlalu tinggi untuk SD kelas II.' }]);
});

test('periksaKonsistensi tidak menghalangi guru bila AI gagal', async () => {
  globalThis.fetch = async () => new Response('galat', { status: 500 });
  assert.deepEqual(await periksaKonsistensi(isianModul), []);
});

const isianSaran = { mapel: 'Matematika', jenjang: 'SMP', kelas: 'VII', semester: 'Ganjil', jumlahPertemuan: 16 };

test('saranModul menggabungkan materi dengan koma dan TP per baris, dalam batas panjang isian', async () => {
  const panjang = 'materi '.repeat(10).trim(); // 69 karakter
  globalThis.fetch = async () =>
    balasJson({
      materi: ['Bilangan bulat', panjang, panjang, panjang, panjang, panjang],
      tujuan: ['Peserta didik mampu mengoperasikan bilangan bulat.', 'Peserta didik mampu menyelesaikan persamaan linear.'],
    });
  const hasil = await saranModul(isianSaran);
  assert.ok(hasil.topik.startsWith('Bilangan bulat, materi'));
  assert.ok(hasil.topik.length <= 300);
  assert.equal(hasil.tujuanPembelajaran.split('\n').length, 2);
});

test('saranModul menolak jawaban AI yang tidak sesuai format', async () => {
  globalThis.fetch = async () => balasJson({ materi: [] });
  await assert.rejects(saranModul(isianSaran), /tidak terbaca/);
});
