-- Verifikasi email
ALTER TABLE "User" ADD COLUMN "emailTerverifikasi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tokenVerifikasi" TEXT,
ADD COLUMN "tokenKedaluwarsa" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_tokenVerifikasi_key" ON "User"("tokenVerifikasi");

-- Akun yang sudah ada sebelum fitur verifikasi dianggap terverifikasi supaya tetap bisa masuk.
UPDATE "User" SET "emailTerverifikasi" = true;

-- Nama kelas baku
ALTER TABLE "Kelas" ADD COLUMN "tingkat" TEXT,
ADD COLUMN "jurusan" TEXT,
ADD COLUMN "rombel" TEXT;

-- Modul berformat rencana semester
ALTER TABLE "Modul" ADD COLUMN "semester" TEXT,
ADD COLUMN "jumlahPertemuan" INTEGER;
