// Daftar pilihan dropdown "Pilih nama kamu" di Google Form, dibuat dari siswa satu kelas.
// Teks pilihan dipakai sebagai kunci saat membaca jawaban, jadi harus unik: bila ada nama kembar,
// NIS ditambahkan di belakangnya.

export interface SiswaPilihan {
  id: string;
  nama: string;
  nis: string;
}

export function bangunPilihan(siswa: SiswaPilihan[]): Record<string, string> {
  const urut = [...siswa].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  const hitung = new Map<string, number>();
  urut.forEach((s) => hitung.set(s.nama.trim(), (hitung.get(s.nama.trim()) ?? 0) + 1));

  const hasil: Record<string, string> = {};
  for (const s of urut) {
    const nama = s.nama.trim();
    let label = (hitung.get(nama) ?? 0) > 1 ? `${nama} (${s.nis})` : nama;
    for (let n = 2; label in hasil; n++) label = `${nama} (${s.nis}) ${n}`;
    hasil[label] = s.id;
  }
  return hasil;
}
