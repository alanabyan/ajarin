-- AlterTable
ALTER TABLE "Butir" ADD COLUMN "ragu" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SetSoal" ADD COLUMN "targetKelasId" TEXT,
ADD COLUMN "targetSiswa" TEXT[] DEFAULT ARRAY[]::TEXT[];
