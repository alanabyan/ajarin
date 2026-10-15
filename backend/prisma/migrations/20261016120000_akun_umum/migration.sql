-- Akun bersifat umum: jenjang dan mata pelajaran tidak lagi wajib saat daftar.
ALTER TABLE "User" ALTER COLUMN "jenjang" DROP NOT NULL,
ALTER COLUMN "mapel" DROP NOT NULL;
