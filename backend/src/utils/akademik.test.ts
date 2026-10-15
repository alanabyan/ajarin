import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fase, namaKelasBaku, periksaKonflikJenjang, tapelValid } from './akademik';

const LABEL = { judul: 'Judul modul', topik: 'Cakupan materi' };

test('periksaKonflikJenjang menandai judul yang menyebut jenjang lain', () => {
  const m = periksaKonflikJenjang({ judul: 'Modul IPA SD' }, LABEL, 'SMK', 'X');
  assert.equal(m.length, 1);
  assert.equal(m[0].bagian, 'judul');
  assert.match(m[0].pesan, /SD/);
});

test('periksaKonflikJenjang menandai kelas lain dalam angka atau Romawi', () => {
  assert.equal(periksaKonflikJenjang({ judul: 'Pecahan kelas 4' }, LABEL, 'SD', 'V').length, 1);
  assert.equal(periksaKonflikJenjang({ judul: 'Pecahan kelas IV' }, LABEL, 'SD', 'V').length, 1);
  assert.equal(periksaKonflikJenjang({ judul: 'Pecahan kelas 5' }, LABEL, 'SD', 'V').length, 0);
});

test('periksaKonflikJenjang tidak salah tangkap kata biasa', () => {
  assert.deepEqual(periksaKonflikJenjang({ topik: 'Kelas ini membahas smart city dan mitigasi bencana' }, LABEL, 'SMA', 'X'), []);
  assert.deepEqual(periksaKonflikJenjang({ judul: 'Matematika SMA kelas X' }, LABEL, 'SMA', 'X'), []);
});

test('namaKelasBaku menyusun nama seragam', () => {
  assert.equal(namaKelasBaku('X', ' rpl ', '1'), 'X RPL 1');
  assert.equal(namaKelasBaku('VII', '', 'a'), 'VII A');
  assert.equal(namaKelasBaku('XII', null, null), 'XII');
});

test('tapelValid hanya menerima tahun berurutan', () => {
  assert.ok(tapelValid('2026/2027'));
  assert.ok(!tapelValid('2026/2028'));
  assert.ok(!tapelValid('2026-2027'));
});

test('fase mengikuti tingkat kelas', () => {
  assert.equal(fase('I'), 'A');
  assert.equal(fase('IV'), 'B');
  assert.equal(fase('VIII'), 'D');
  assert.equal(fase('X'), 'E');
  assert.equal(fase('XII'), 'F');
});
