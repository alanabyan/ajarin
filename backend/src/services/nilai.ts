import { prisma } from '../lib/db';
import { HttpError } from '../lib/http';
import { normNis } from '../utils/nis';

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
