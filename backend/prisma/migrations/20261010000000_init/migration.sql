-- CreateEnum
CREATE TYPE "Jenjang" AS ENUM ('SD', 'SMP', 'SMA', 'SMK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "jenjang" "Jenjang" NOT NULL,
    "mapel" TEXT NOT NULL,
    "sekolah" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kelas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tapel" TEXT NOT NULL,
    "kkm" INTEGER NOT NULL DEFAULT 75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Siswa" (
    "id" TEXT NOT NULL,
    "kelasId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nis" TEXT NOT NULL,

    CONSTRAINT "Siswa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nilai" (
    "id" TEXT NOT NULL,
    "siswaId" TEXT NOT NULL,
    "mapel" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "judul" TEXT NOT NULL DEFAULT '',
    "nilai" DOUBLE PRECISION NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nilai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modul" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "topik" TEXT NOT NULL,
    "jenjang" "Jenjang" NOT NULL,
    "kelas" TEXT NOT NULL,
    "alokasiWaktu" TEXT NOT NULL,
    "tujuanPembelajaran" TEXT NOT NULL,
    "kondisiKelas" TEXT,
    "konten" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Modul_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetSoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "mapel" TEXT NOT NULL,
    "kelas" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formId" TEXT,
    "formUrl" TEXT,
    "formEditUrl" TEXT,
    "formKelasId" TEXT,
    "formSiswaQid" TEXT,
    "formPilihan" JSONB,

    CONSTRAINT "SetSoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Butir" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,
    "materi" TEXT NOT NULL,
    "tingkat" TEXT NOT NULL,
    "pertanyaan" TEXT NOT NULL,
    "pilihan" JSONB NOT NULL,
    "kunci" INTEGER NOT NULL,
    "pembahasan" TEXT NOT NULL,
    "formQid" TEXT,

    CONSTRAINT "Butir_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Kelas_userId_idx" ON "Kelas"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Siswa_kelasId_nis_key" ON "Siswa"("kelasId", "nis");

-- CreateIndex
CREATE UNIQUE INDEX "Nilai_siswaId_mapel_jenis_judul_key" ON "Nilai"("siswaId", "mapel", "jenis", "judul");

-- CreateIndex
CREATE INDEX "Modul_userId_createdAt_idx" ON "Modul"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SetSoal_userId_createdAt_idx" ON "SetSoal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Butir_setId_idx" ON "Butir"("setId");

-- AddForeignKey
ALTER TABLE "Kelas" ADD CONSTRAINT "Kelas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siswa" ADD CONSTRAINT "Siswa_kelasId_fkey" FOREIGN KEY ("kelasId") REFERENCES "Kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nilai" ADD CONSTRAINT "Nilai_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "Siswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modul" ADD CONSTRAINT "Modul_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetSoal" ADD CONSTRAINT "SetSoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Butir" ADD CONSTRAINT "Butir_setId_fkey" FOREIGN KEY ("setId") REFERENCES "SetSoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

