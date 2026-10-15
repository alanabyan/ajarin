import { prisma } from '../lib/db';
import { HttpError } from '../lib/http';
import { mapelResmi } from '../utils/akademik';
import { normNis } from '../utils/nis';

export const BATAS_UAS = 2;

export interface ItemNilai {
  siswaId?: string;
  siswaBaru?: { nama: string; nis: string };
  nilai: number;
}

// Menyimpan nilai satu kelas sekaligus (satu mapel + jenis + judul). Siswa baru ikut dibuat di kelas.
// Nilai yang sudah ada untuk kombinasi yang sama DIPERBARUI, bukan digandakan, sehingga impor ulang aman.
// Semuanya berjalan dalam satu transaksi: gagal berarti tidak ada yang tersimpan.
export async function simpanNilaiKelas(
  kelasId: string,
  userId: string,
  mapel: string,
  jenis: string,
  judul: string,
  items: ItemNilai[]
) {
  const kelas = await prisma.kelas.findFirst({ where: { id: kelasId, userId }, include: { siswa: true } });
  if (!kelas) throw new HttpError(404, 'Kelas tidak ditemukan.');

  // Mata pelajaran harus resmi, atau mapel khusus yang memang sudah dipakai guru (di bank soal, modul, atau kelas ini).
  // Tanpa ini, batas UAS per mapel bisa dilewati dengan mengetik nama mapel asal ("ada", "adada", ...).
  const resmi = mapelResmi(mapel);
  if (resmi) {
    mapel = resmi;
  } else {
    const [soal, modul, nilaiKelas] = await Promise.all([
      prisma.setSoal.findFirst({ where: { userId, mapel }, select: { id: true } }),
      prisma.modul.findFirst({ where: { userId, mapel }, select: { id: true } }),
      prisma.nilai.findFirst({ where: { mapel, siswa: { kelasId } }, select: { id: true } }),
    ]);
    if (!soal && !modul && !nilaiKelas) {
      throw new HttpError(400, `Mata pelajaran "${mapel}" tidak dikenal. Pilih dari daftar mata pelajaran.`, {
        kolom: { mapel: 'Pilih mata pelajaran dari daftar.' },
      });
    }
  }

  // UAS paling banyak 2 kali per mata pelajaran di satu kelas (semester ganjil dan genap).
  // Menyimpan ulang UAS yang sudah ada (judul sama) tetap boleh, karena hanya memperbarui nilainya.
  if (jenis === 'UAS') {
    const ada = await prisma.nilai.findMany({
      where: { jenis: 'UAS', mapel, siswa: { kelasId } },
      distinct: ['judul'],
      select: { judul: true },
    });
    const judulAda = ada.map((n) => n.judul);
    if (!judulAda.includes(judul) && judulAda.length >= BATAS_UAS) {
      const daftar = judulAda.map((j) => `"${j || 'tanpa judul'}"`).join(' dan ');
      throw new HttpError(
        400,
        `UAS ${mapel} di kelas ini sudah ${BATAS_UAS} kali (${daftar}). Maksimal ${BATAS_UAS} UAS per mata pelajaran; pakai judul UAS yang sudah ada untuk memperbarui nilainya.`
      );
    }
  }

  const idKelas = new Set(kelas.siswa.map((s) => s.id));
  const perNis = new Map(kelas.siswa.map((s) => [normNis(s.nis), s]));
  const perSiswa = new Map<string, { nilai: number; baru?: { nama: string; nis: string } }>();
  const kunciBaru = new Map<string, string>(); // nis ternormalisasi -> kunci sementara

  for (const item of items) {
    if (item.siswaId) {
      if (!idKelas.has(item.siswaId)) throw new HttpError(400, 'Ada siswa yang bukan anggota kelas ini.');
      perSiswa.set(item.siswaId, { nilai: item.nilai });
    } else if (item.siswaBaru) {
      const nis = normNis(item.siswaBaru.nis);
      const ada = perNis.get(nis);
      if (ada) {
        perSiswa.set(ada.id, { nilai: item.nilai });
      } else {
        const kunci = kunciBaru.get(nis) ?? `baru:${nis}`;
        kunciBaru.set(nis, kunci);
        perSiswa.set(kunci, { nilai: item.nilai, baru: item.siswaBaru });
      }
    } else {
      throw new HttpError(400, 'Tiap baris harus berisi siswa yang ada atau siswa baru.');
    }
  }

  return prisma.$transaction(async (tx) => {
    let dibuat = 0;
    let diperbarui = 0;
    let siswaBaru = 0;

    for (const [kunci, { nilai, baru }] of perSiswa) {
      let siswaId = kunci;
      if (baru) {
        const s = await tx.siswa.create({ data: { kelasId, nama: baru.nama, nis: baru.nis.trim() } });
        siswaId = s.id;
        siswaBaru++;
      }
      const sudah = await tx.nilai.findUnique({
        where: { siswaId_mapel_jenis_judul: { siswaId, mapel, jenis, judul } },
        select: { id: true },
      });
      await tx.nilai.upsert({
        where: { siswaId_mapel_jenis_judul: { siswaId, mapel, jenis, judul } },
        create: { siswaId, mapel, jenis, judul, nilai },
        update: { nilai, tanggal: new Date() },
      });
      if (sudah) diperbarui++;
      else dibuat++;
    }
    return { dibuat, diperbarui, siswaBaru };
  });
}
