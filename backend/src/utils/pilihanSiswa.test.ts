import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bangunPilihan } from './pilihanSiswa';

test('nama unik dipakai apa adanya dan diurutkan abjad', () => {
  const p = bangunPilihan([
    { id: '2', nama: 'Budi', nis: '2' },
    { id: '1', nama: 'Ani', nis: '1' },
  ]);
  assert.deepEqual(Object.keys(p), ['Ani', 'Budi']);
  assert.equal(p['Budi'], '2');
});

test('nama kembar dibedakan dengan NIS', () => {
  const p = bangunPilihan([
    { id: '1', nama: 'Siti', nis: '101' },
    { id: '2', nama: 'Siti', nis: '102' },
  ]);
  assert.equal(p['Siti (101)'], '1');
  assert.equal(p['Siti (102)'], '2');
});

test('label selalu unik meski nama dan NIS sama', () => {
  const p = bangunPilihan([
    { id: '1', nama: 'Siti', nis: '1' },
    { id: '2', nama: 'Siti', nis: '1' },
  ]);
  assert.equal(Object.keys(p).length, 2);
});
