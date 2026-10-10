import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { HttpError } from './http';
import { alirkanNdjson, putusBilaKlienPergi } from './ndjson';

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Server Express sungguhan dengan satu rute yang aliran dan penyimpanannya ditentukan tiap tes.
let sekarang: (signal: AbortSignal) => { aliran: AsyncIterable<string>; simpan: (t: string) => Promise<{ id: string }> };
const app = express();
app.post('/alir', async (_req, res) => {
  const putus = putusBilaKlienPergi(res);
  const { aliran, simpan } = sekarang(putus.signal);
  await alirkanNdjson(res, putus, aliran, simpan);
});
const server: Server = createServer(app).listen(0);
const url = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/alir`;

async function baca(res: Response): Promise<{ baris: object[]; waktu: number[] }> {
  const reader = res.body!.getReader();
  const dekoder = new TextDecoder();
  const baris: object[] = [];
  const waktu: number[] = [];
  let sisa = '';
  const mulai = Date.now();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sisa += dekoder.decode(value, { stream: true });
    const bagian = sisa.split('\n');
    sisa = bagian.pop() ?? '';
    for (const b of bagian.filter(Boolean)) {
      baris.push(JSON.parse(b));
      waktu.push(Date.now() - mulai);
    }
  }
  return { baris, waktu };
}

test('potongan teks dikirim bertahap (tidak ditahan sampai selesai), lalu id setelah tersimpan', async () => {
  let tersimpan = '';
  sekarang = () => ({
    aliran: (async function* () {
      yield '# Modul';
      await tidur(300);
      yield '\n\nIsi';
    })(),
    simpan: async (t) => {
      tersimpan = t;
      return { id: 'abc' };
    },
  });
  const res = await fetch(url(), { method: 'POST' });
  assert.match(res.headers.get('content-type') ?? '', /application\/x-ndjson/);
  const { baris, waktu } = await baca(res);
  assert.deepEqual(baris, [{ t: '# Modul' }, { t: '\n\nIsi' }, { id: 'abc' }]);
  assert.ok(waktu[0] < 200, `potongan pertama harus tiba sebelum aliran selesai (tiba di ${waktu[0]} ms)`);
  assert.equal(tersimpan, '# Modul\n\nIsi');
});

test('galat di tengah aliran dikirim sebagai baris error dan tidak menyimpan apa pun', async () => {
  let disimpan = false;
  sekarang = () => ({
    aliran: (async function* () {
      yield 'sebagian';
      throw new HttpError(504, 'AI terlalu lama merespons. Coba lagi.');
    })(),
    simpan: async () => {
      disimpan = true;
      return { id: 'x' };
    },
  });
  const { baris } = await baca(await fetch(url(), { method: 'POST' }));
  assert.deepEqual(baris, [{ t: 'sebagian' }, { error: 'AI terlalu lama merespons. Coba lagi.' }]);
  assert.equal(disimpan, false);
});

test('jawaban kosong dilaporkan sebagai galat, bukan disimpan', async () => {
  let disimpan = false;
  sekarang = () => ({
    aliran: (async function* () {
      yield '   ';
    })(),
    simpan: async () => {
      disimpan = true;
      return { id: 'x' };
    },
  });
  const { baris } = await baca(await fetch(url(), { method: 'POST' }));
  assert.equal(disimpan, false);
  assert.ok('error' in (baris.at(-1) as object));
});

test('klien memutus koneksi: AI dihentikan dan tidak ada yang disimpan', async () => {
  let disimpan = false;
  let sinyal: AbortSignal | undefined;
  let berhenti = false;
  sekarang = (signal) => {
    sinyal = signal;
    return {
      aliran: (async function* () {
        try {
          for (let i = 0; i < 100; i++) {
            yield `potongan ${i} `;
            await tidur(30);
          }
        } finally {
          berhenti = true;
        }
      })(),
      simpan: async () => {
        disimpan = true;
        return { id: 'x' };
      },
    };
  };
  const ctrl = new AbortController();
  const res = await fetch(url(), { method: 'POST', signal: ctrl.signal });
  await res.body!.getReader().read(); // terima potongan pertama, lalu pergi
  ctrl.abort();
  await tidur(250);
  assert.equal(sinyal?.aborted, true, 'signal AI harus dibatalkan');
  assert.equal(berhenti, true, 'generator harus berhenti');
  assert.equal(disimpan, false);
});

// Selalu paling akhir: fetch menjaga koneksi tetap hidup, jadi tanpa ini proses uji tidak pernah selesai.
test('menutup server uji', () => {
  server.close();
  server.closeAllConnections();
});
