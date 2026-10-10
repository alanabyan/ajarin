import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DataKelas, DataSet, hitungDampak } from './dampak';

const hari = (n: number) => new Date(Date.UTC(2026, 8, n));
const nilai = (judul: string, v: number, tgl: number, jenis = 'UH') => ({ mapel: 'Matematika', jenis, judul, nilai: v, tanggal: hari(tgl) });

const kelas: DataKelas[] = [
  {
    id: 'k1',
    nama: '7A',
    kkm: 75,
    siswa: [
      { id: 'eko', nama: 'Eko', nis: '1', nilai: [nilai('Operasi Bilangan', 80, 1, 'Tugas'), nilai('Kuis PLSV', 68, 10), nilai('Remedial: Kuis PLSV', 80, 15)] },
      { id: 'galih', nama: 'Galih', nis: '2', nilai: [nilai('Operasi Bilangan', 60, 1, 'Tugas'), nilai('Kuis PLSV', 54, 10), nilai('Remedial: Kuis PLSV', 72, 15)] },
      { id: 'ani', nama: 'Ani', nis: '3', nilai: [nilai('Operasi Bilangan', 88, 1, 'Tugas'), nilai('Kuis PLSV', 92, 10)] },
      { id: 'kosong', nama: 'Belum Ada Nilai', nis: '4', nilai: [] },
    ],
  },
];

const sets: DataSet[] = [
  {
    id: 's1',
    judul: 'Kuis PLSV',
    sumberId: null,
    targetKelasId: null,
    targetSiswa: [],
    analisis: [
      { butirId: 'b1', persenBenar: 85 },
      { butirId: 'b2', persenBenar: 40 },
      { butirId: 'b3', persenBenar: 33 },
      { butirId: 'b4', persenBenar: null },
    ],
    butir: [
      { id: 'b1', materi: 'Persamaan linear' },
      { id: 'b2', materi: 'persamaan Linear ' },
      { id: 'b3', materi: 'Persamaan linear' },
      { id: 'b4', materi: 'Pecahan' },
    ],
  },
  {
    id: 's2',
    judul: 'Remedial: Kuis PLSV',
    sumberId: 's1',
    targetKelasId: 'k1',
    targetSiswa: ['eko', 'galih'],
    analisis: null,
    butir: [],
  },
];

test('tren: rata-rata kelas per penilaian, urut tanggal, tanpa penilaian remedial', () => {
  const { tren } = hitungDampak(kelas, sets);
  assert.deepEqual(
    tren[0].titik.map((t) => [t.label, t.rata, t.jumlah]),
    [
      ['Tugas: Operasi Bilangan', 76, 3],
      ['UH: Kuis PLSV', 71.3, 3],
    ]
  );
});

test('peta materi: nama digabung tanpa membedakan huruf besar, soal tanpa data diabaikan, terlemah di atas', () => {
  const { materi } = hitungDampak(kelas, sets);
  assert.equal(materi.length, 1);
  assert.deepEqual(materi[0], { materi: 'Persamaan linear', persenBenar: 53, jumlahSoal: 3, status: 'lemah' });
});

test('dampak remedial: rata-rata sebelum/sesudah, jumlah naik, dan yang baru tuntas', () => {
  const { remedial } = hitungDampak(kelas, sets);
  assert.equal(remedial.sets.length, 1);
  assert.deepEqual(remedial.total, { jumlahSet: 1, jumlahSiswa: 2, naik: 2, tuntasBaru: 1, sebelum: 61, sesudah: 76 });
});

test('siswa perhatian: alasan lengkap, yang baik tidak muncul, urut dari alasan terbanyak', () => {
  const { perhatian } = hitungDampak(kelas, sets);
  assert.deepEqual(
    perhatian.map((p) => p.siswaId),
    ['galih', 'eko']
  );
  assert.equal(perhatian[0].alasan.length, 2); // di bawah KKM + masih di bawah setelah remedial
  assert.match(perhatian[0].alasan.join('|'), /Masih di bawah KKM setelah remedial/);
  assert.match(perhatian[1].alasan[0], /Turun 12 poin/);
});

test('ringkasan: siswa tanpa nilai tidak ikut dihitung, tanpa data tidak error', () => {
  const r = hitungDampak(kelas, sets).ringkasan;
  assert.equal(r.jumlahSiswa, 4);
  assert.equal(r.siswaBerNilai, 3);
  assert.equal(r.persenTuntas, 67); // Eko 76 dan Ani 85 tuntas; Galih 62 tidak
  assert.equal(r.jumlahAnalisis, 1);

  const kosong = hitungDampak([], []);
  assert.equal(kosong.ringkasan.rataRata, null);
  assert.equal(kosong.ringkasan.persenTuntas, null);
  assert.deepEqual(kosong.materi, []);
  assert.equal(kosong.remedial.total.sebelum, null);
});
