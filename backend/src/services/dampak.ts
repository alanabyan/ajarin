// Menghitung "dampak" dari data yang sudah tersimpan: tren nilai kelas, peta materi, siswa yang perlu
// perhatian, dan hasil remedial. Murni (tanpa database) supaya mudah diuji; rute yang memuat datanya.

export interface DataNilai {
  mapel: string;
  jenis: string;
  judul: string;
  nilai: number;
  tanggal: Date;
}

export interface DataSiswa {
  id: string;
  nama: string;
  nis: string;
  nilai: DataNilai[];
}

export interface DataKelas {
  id: string;
  nama: string;
  kkm: number;
  siswa: DataSiswa[];
}

export interface DataSet {
  id: string;
  judul: string;
  sumberId: string | null;
  targetKelasId: string | null;
  targetSiswa: string[];
  /** Salinan analisis butir saat impor nilai: [{ butirId, persenBenar }]. */
  analisis: { butirId: string; persenBenar: number | null }[] | null;
  butir: { id: string; materi: string }[];
}

export type StatusMateri = 'lemah' | 'cukup' | 'kuat';

export const BATAS_LEMAH = 60;
export const BATAS_KUAT = 80;

const rata = (v: number[]): number | null => (v.length ? v.reduce((t, n) => t + n, 0) / v.length : null);
const bulat = (n: number | null, d = 1): number | null => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);
const labelPenilaian = (n: { jenis: string; judul: string }) => `${n.jenis}${n.judul ? `: ${n.judul}` : ''}`;

export function hitungDampak(kelas: DataKelas[], sets: DataSet[]) {
  const perId = new Map(sets.map((s) => [s.id, s]));
  const judulRemedial = new Set(sets.filter((s) => s.sumberId).map((s) => s.judul));

  // 1. Tren nilai tiap kelas: rata-rata kelas per penilaian, urut tanggal. Penilaian remedial dikeluarkan
  //    karena hanya diikuti sebagian siswa dan akan menyeret rata-rata.
  const tren = kelas.map((k) => {
    const grup = new Map<string, { label: string; tanggal: Date; nilai: number[] }>();
    for (const s of k.siswa) {
      for (const n of s.nilai) {
        if (judulRemedial.has(n.judul)) continue;
        const kunci = `${n.mapel}|${n.jenis}|${n.judul}`;
        const g = grup.get(kunci) ?? { label: labelPenilaian(n), tanggal: n.tanggal, nilai: [] };
        g.nilai.push(n.nilai);
        if (n.tanggal > g.tanggal) g.tanggal = n.tanggal;
        grup.set(kunci, g);
      }
    }
    const titik = [...grup.values()]
      .sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime())
      .map((g) => ({ label: g.label, tanggal: g.tanggal.toISOString(), rata: bulat(rata(g.nilai))!, jumlah: g.nilai.length }));
    return { kelasId: k.id, nama: k.nama, kkm: k.kkm, titik };
  });

  // 2. Peta materi: rata-rata persen benar per materi dari seluruh analisis tersimpan.
  const materiPerKunci = new Map<string, { materi: string; persen: number[] }>();
  for (const s of sets) {
    const materiButir = new Map(s.butir.map((b) => [b.id, b.materi]));
    for (const a of s.analisis ?? []) {
      const materi = materiButir.get(a.butirId)?.trim();
      if (!materi || a.persenBenar === null) continue;
      const kunci = materi.toLowerCase();
      const m = materiPerKunci.get(kunci) ?? { materi, persen: [] };
      m.persen.push(a.persenBenar);
      materiPerKunci.set(kunci, m);
    }
  }
  const materi = [...materiPerKunci.values()]
    .map((m) => {
      const p = bulat(rata(m.persen), 0)!;
      const status: StatusMateri = p < BATAS_LEMAH ? 'lemah' : p < BATAS_KUAT ? 'cukup' : 'kuat';
      return { materi: m.materi, persenBenar: p, jumlahSoal: m.persen.length, status };
    })
    .sort((a, b) => a.persenBenar - b.persenBenar);

  // 3. Hasil remedial: nilai siswa sasaran pada set asal vs set remedial.
  const remedial = sets
    .filter((s) => s.sumberId && s.targetKelasId && s.targetSiswa.length > 0 && perId.has(s.sumberId))
    .flatMap((s) => {
      const k = kelas.find((x) => x.id === s.targetKelasId);
      const sumber = perId.get(s.sumberId!)!;
      if (!k) return [];
      const pasangan = k.siswa
        .filter((sw) => s.targetSiswa.includes(sw.id))
        .flatMap((sw) => {
          const ambil = (judul: string) => sw.nilai.filter((n) => n.judul === judul).sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime())[0];
          const sebelum = ambil(sumber.judul);
          const sesudah = ambil(s.judul);
          return sebelum && sesudah ? [{ sebelum: sebelum.nilai, sesudah: sesudah.nilai }] : [];
        });
      if (pasangan.length === 0) return [];
      return [
        {
          setId: s.id,
          judul: s.judul,
          sumberJudul: sumber.judul,
          kkm: k.kkm,
          jumlahSiswa: pasangan.length,
          sebelum: bulat(rata(pasangan.map((p) => p.sebelum)))!,
          sesudah: bulat(rata(pasangan.map((p) => p.sesudah)))!,
          naik: pasangan.filter((p) => p.sesudah > p.sebelum).length,
          tuntasBaru: pasangan.filter((p) => p.sebelum < k.kkm && p.sesudah >= k.kkm).length,
        },
      ];
    });
  const siswaRemedial = remedial.reduce((t, r) => t + r.jumlahSiswa, 0);
  const totalRemedial = {
    jumlahSet: remedial.length,
    jumlahSiswa: siswaRemedial,
    naik: remedial.reduce((t, r) => t + r.naik, 0),
    tuntasBaru: remedial.reduce((t, r) => t + r.tuntasBaru, 0),
    // Rata-rata berbobot jumlah siswa, supaya set kecil tidak menyeret angka total.
    sebelum: siswaRemedial ? bulat(remedial.reduce((t, r) => t + r.sebelum * r.jumlahSiswa, 0) / siswaRemedial) : null,
    sesudah: siswaRemedial ? bulat(remedial.reduce((t, r) => t + r.sesudah * r.jumlahSiswa, 0) / siswaRemedial) : null,
  };

  // 4. Siswa yang perlu perhatian: rata-rata di bawah KKM, nilai turun tajam, atau tetap di bawah KKM setelah remedial.
  const sasaranGagal = new Set<string>();
  for (const r of remedial) {
    const s = perId.get(r.setId)!;
    const k = kelas.find((x) => x.id === s.targetKelasId)!;
    for (const sw of k.siswa) {
      const n = sw.nilai.find((x) => x.judul === s.judul);
      if (s.targetSiswa.includes(sw.id) && n && n.nilai < k.kkm) sasaranGagal.add(sw.id);
    }
  }
  const perhatian = kelas
    .flatMap((k) =>
      k.siswa.flatMap((sw) => {
        if (sw.nilai.length === 0) return [];
        const r = rata(sw.nilai.map((n) => n.nilai))!;
        const alasan: string[] = [];
        if (r < k.kkm) alasan.push(`Rata-rata ${bulat(r)} di bawah KKM ${k.kkm}`);
        const reguler = sw.nilai.filter((n) => !judulRemedial.has(n.judul)).sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime());
        if (reguler.length >= 2) {
          const turun = reguler[reguler.length - 2].nilai - reguler[reguler.length - 1].nilai;
          if (turun >= 10) alasan.push(`Turun ${bulat(turun, 0)} poin dari penilaian sebelumnya`);
        }
        if (sasaranGagal.has(sw.id)) alasan.push('Masih di bawah KKM setelah remedial');
        return alasan.length
          ? [{ siswaId: sw.id, kelasId: k.id, kelasNama: k.nama, nama: sw.nama, rataRata: bulat(r)!, alasan }]
          : [];
      })
    )
    .sort((a, b) => b.alasan.length - a.alasan.length || a.rataRata - b.rataRata)
    .slice(0, 10);

  // 5. Ringkasan
  const semuaSiswa = kelas.flatMap((k) => k.siswa.map((s) => ({ k, s })));
  const berNilai = semuaSiswa.filter(({ s }) => s.nilai.length > 0);
  const rataSiswa = berNilai.map(({ s }) => rata(s.nilai.map((n) => n.nilai))!);
  const tuntas = berNilai.filter(({ k, s }) => rata(s.nilai.map((n) => n.nilai))! >= k.kkm).length;
  const ringkasan = {
    jumlahKelas: kelas.length,
    jumlahSiswa: semuaSiswa.length,
    siswaBerNilai: berNilai.length,
    rataRata: bulat(rata(rataSiswa)),
    persenTuntas: berNilai.length ? Math.round((tuntas / berNilai.length) * 100) : null,
    jumlahAnalisis: sets.filter((s) => s.analisis && s.analisis.length > 0).length,
  };

  return { ringkasan, tren, materi, perhatian, remedial: { sets: remedial, total: totalRemedial } };
}

export type HasilDampak = ReturnType<typeof hitungDampak>;
