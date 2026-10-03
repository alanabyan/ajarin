# Ajarin — Sistem Perangkat Ajar untuk Guru Honorer

Platform untuk membantu guru honorer menyiapkan modul ajar, bank soal, dan rekap
nilai lebih cepat, supaya waktu mereka lebih banyak dipakai untuk mengajar.

## Struktur proyek

```
ajarin/
├── backend/   → Express + TypeScript + Prisma (API)
└── frontend/  → React + TypeScript + Vite (antarmuka)
```

## Fitur MVP

- Autentikasi guru (daftar, masuk)
- Generator modul ajar berbasis AI (Claude), bisa diedit dan diekspor manual
- Generator bank soal pilihan ganda beserta kunci jawaban dan pembahasan
- Manajemen kelas dan siswa
- Pencatatan nilai serta rekap rata-rata per kelas

## 1. Menyiapkan database (Supabase atau Neon)

Keduanya PostgreSQL, jadi memakai skema Prisma yang sama.

**Opsi A — Supabase**
1. Buat project baru di supabase.com.
2. Buka *Project Settings → Database → Connection string*, pilih mode
   *Transaction* (port 6543) untuk pemakaian umum, atau *Session* (port 5432)
   jika butuh koneksi persisten.
3. Salin connection string tersebut ke `DATABASE_URL` di `backend/.env`.

**Opsi B — Neon**
1. Buat project baru di neon.tech.
2. Buka *Dashboard → Connection Details*, salin connection string yang sudah
   menyertakan `?sslmode=require`.
3. Tempel ke `DATABASE_URL` di `backend/.env`.

## 2. Menjalankan backend

```bash
cd backend
npm install
cp .env.example .env
# lalu isi DATABASE_URL, JWT_SECRET, dan ANTHROPIC_API_KEY di .env

npx prisma migrate dev --name init   # membuat tabel di database
npx prisma db seed                   # isi akun guru contoh + kelas + siswa
npm run dev                          # jalan di http://localhost:4000
```

Setelah seed berhasil, kamu bisa langsung masuk di halaman `/masuk` dengan:

- **Email**: `guru@ajarin.test`
- **Kata sandi**: `password123`

Akun ini sudah punya satu kelas (8B) berisi 4 siswa lengkap dengan nilai tugas
contoh, supaya halaman Kelas & Nilai tidak kosong saat pertama kali dicoba.
Seed ini aman dijalankan berulang kali — tidak akan membuat data duplikat.

Kalau ingin melihat isi database lewat GUI, jalankan `npm run prisma:studio`.

## 3. Menjalankan frontend

```bash
cd frontend
npm install
npm run dev   # jalan di http://localhost:5173
```

Frontend sudah diatur untuk memproksi permintaan `/api` ke `http://localhost:4000`
lewat `vite.config.ts`, jadi tidak perlu konfigurasi tambahan saat development.

## 4. Alur pemakaian singkat

1. Daftar akun guru di `/daftar` (isi jenjang dan mata pelajaran).
2. Dari Beranda, buat modul ajar baru — isi topik, alokasi waktu, dan kondisi
   kelas, lalu sistem menyusun draf yang bisa diedit dan ditandai final.
3. Buat set soal dari menu Bank Soal dengan materi dan tingkat kesulitan.
4. Di menu Kelas & Nilai, tambahkan kelas, siswa, dan nilai untuk melihat
   rata-rata tiap siswa.

## Catatan pengembangan lanjutan

- **Ekspor Word/PDF**: saat ini modul ajar hanya bisa disalin manual dari
  editor teks; menambahkan ekspor otomatis adalah pengembangan lanjutan yang
  wajar untuk MVP berikutnya.
- **Keamanan produksi**: ganti `JWT_SECRET` dengan nilai acak yang kuat, dan
  jangan commit file `.env` ke git (`.gitignore` sudah menanganinya).
- **Rate limiting & validasi tambahan**: belum ada pembatasan jumlah panggilan
  AI per pengguna — penting ditambahkan sebelum dipakai banyak orang, supaya
  biaya panggilan API Claude tetap terkendali.
- **Deploy**: backend bisa di-deploy ke Railway/Render, frontend ke
  Vercel/Netlify. Pastikan `CLIENT_URL` (backend) dan URL API (frontend)
  disesuaikan dengan domain produksi.
