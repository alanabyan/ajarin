# Ajarin

**Penerang jalan guru mengajar.** Platform untuk guru honorer: menyusun modul ajar, membuat bank soal,
membagikannya sebagai kuis Google Form / Kahoot, lalu merekap nilai dan melihat materi yang belum dikuasai siswa.

Karya lomba Web Development ITASE 7.0, tema **SDG 4: Quality Education** (target 4.c, guru berkualitas).

## Fitur

| Fitur | Keterangan |
| --- | --- |
| Modul ajar (AI) | Rencana satu semester (format RPS): identitas, CP, TP, tabel rencana per pertemuan (TP, indikator, materi, metode & waktu, penilaian, bobot), komposisi penilaian, dan sumber belajar; tampil bertahap saat AI menulis; sunting dengan pratinjau Markdown + rumus KaTeX; cetak / simpan PDF atau unduh Word (.docx) |
| Bank soal (AI) | Soal pilihan ganda + kunci + pembahasan; AI mengerjakan ulang tiap soal dan menandai kunci yang meragukan; soal bisa dikoreksi guru; ekspor Word (lembar soal + kunci), Excel, dan template Kahoot |
| Google Form | Kuis otomatis (mode quiz) di Drive guru; soal pertama berupa dropdown nama siswa kelas, jadi siswa tinggal memilih namanya |
| Impor nilai | Jawaban otomatis terhubung ke siswa lewat dropdown nama; daftar siswa yang belum mengisi ditampilkan; impor ulang memperbarui, tidak menggandakan |
| Analisis butir soal | Persentase siswa yang benar per soal, dengan daftar materi yang perlu diulang |
| Dampak & peta belajar | Halaman bukti dampak: peta materi (mana yang belum dikuasai), tren rata-rata kelas, siswa yang perlu perhatian, dan perubahan nilai sebelum / sesudah remedial; bisa dicetak |
| Mode offline (PWA) | Bisa dipasang di layar utama dan dibuka tanpa internet. Modul, soal, kelas, rekap, rapor, dan halaman Dampak yang sudah dimuat tetap bisa dibaca dan dicetak. Data disimpan per akun di perangkat dan dihapus saat keluar. Membuat dengan AI, menyimpan, impor nilai, dan unduhan butuh internet (tombolnya dinonaktifkan dengan penjelasan) |
| Panduan awal | Checklist 4 langkah untuk guru baru; akun demo menampilkan jalur singkat untuk juri |
| Soal remedial | Satu klik dari analisis: soal baru untuk konsep yang lemah, bisa khusus siswa di bawah KKM (dropdown form hanya memuat nama mereka) |
| Kelas & nilai | Nama kelas baku dari dropdown (tingkat Romawi + jurusan + rombel, mis. X RPL 1) dan kelas ganda ditolak; KKM per kelas, impor siswa dari Excel / CSV (atau tempel), rekap nilai, penanda tuntas / remedial, ekspor Excel |
| Akun demo | Satu klik tanpa daftar, berisi data contoh (untuk juri) |
| Verifikasi email | Setelah daftar, akun harus diverifikasi lewat tautan email (berlaku 24 jam, bisa dikirim ulang) sebelum bisa masuk |
| Pemeriksaan isian | Kelas harus sesuai jenjang, teks yang menyebut jenjang/kelas lain ditolak, lalu AI memeriksa kecocokan judul, materi, dan TP dengan mapel dan tingkat kelas (peringatan bisa diabaikan guru) |

## Tech stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, React Router, react-markdown + KaTeX
- Backend: Node.js, Express, TypeScript, Zod, JWT, bcrypt, helmet, express-rate-limit
- Database: PostgreSQL (Supabase / Neon) lewat Prisma
- AI: Groq API. Integrasi: Google Forms API (Google Identity Services)
- Deploy: Vercel (frontend dan backend)

## Menjalankan secara lokal

Prasyarat: Node 18+, database PostgreSQL.

```bash
# Backend
cd backend
npm install
cp .env.example .env        # isi DATABASE_URL, JWT_SECRET, GROQ_API_KEY, SMTP_USER, SMTP_PASS
npx prisma migrate deploy   # membuat tabel
npm run dev                 # http://localhost:4000

# Frontend (terminal lain)
cd frontend
npm install
cp .env.example .env        # isi VITE_GOOGLE_CLIENT_ID bila memakai Google Form
npm run dev                 # http://localhost:5173
```

Tes: `cd backend && npm test`. Setelah menarik pembaruan skema, jalankan `npx prisma migrate deploy` dan `npx prisma generate` (hentikan server dev dulu di Windows).

## Mode offline

- Cangkang aplikasi di-cache oleh service worker (`vite-plugin-pwa`). Data milik guru **tidak** masuk cache service worker, melainkan IndexedDB per akun (`frontend/src/lib/offline`), disiapkan otomatis di latar belakang saat online (maksimal tiap 15 menit) dan dihapus saat keluar akun.
- Uji di browser: `npm run build && npm run preview`, buka aplikasi, tunggu "Siap offline" di menu samping, lalu matikan jaringan (DevTools > Network > Offline) dan muat ulang.
- Build di Node < 20 berjalan berkat penyesuaian di `vite.config.ts` dan `overrides` di `package.json`; di Node 20+ tidak ada bedanya. Disarankan memakai Node 20 atau lebih baru.

## Email verifikasi (Gmail)

1. Aktifkan verifikasi 2 langkah di akun Google pengirim, lalu buat **App Password** di https://myaccount.google.com/apppasswords.
2. Isi `SMTP_USER` (alamat Gmail) dan `SMTP_PASS` (app password 16 huruf) di `backend/.env` dan di environment variable Vercel.
3. Isi `APP_URL` dengan alamat frontend produksi bila berbeda dari origin pertama di `CLIENT_URL` (dipakai untuk tautan di email).

Tanpa SMTP di mode pengembangan, tautan verifikasi dicetak di konsol server. Di produksi, pendaftaran gagal dengan pesan jelas bila SMTP belum diatur. Akun yang sudah ada sebelum fitur ini dianggap terverifikasi oleh migrasi.

## Google Forms (opsional, untuk kuis dan impor nilai)

1. Di Google Cloud Console, aktifkan **Google Forms API** dan buat **OAuth Client ID** (Web application).
2. Tambahkan origin frontend ke *Authorized JavaScript origins*.
3. Tambahkan scope `forms.body`, `forms.responses.readonly`, dan `drive.file` di OAuth consent screen.
4. Isi `VITE_GOOGLE_CLIENT_ID` di frontend.

Token Google hanya dipakai satu kali per permintaan dan tidak disimpan.

## Kesesuaian dengan guidebook ITASE 7.0

- [x] Responsif di berbagai ukuran layar (menu geser di HP, tabel bisa digulir)
- [x] Bahasa Indonesia, tema SDG 4
- [x] Tanpa CMS; framework bebas (React, Express)
- [x] Antarmuka jelas dan ramah pengguna; akun demo untuk juri
- [x] Hosting publik (Vercel), tautan dimasukkan ke proposal
- [x] Repository publik (GitHub / GitLab)
- [ ] Proposal PDF (maks. 30 halaman) dan video YouTube (maks. 3 menit) sesuai ketentuan panitia
- [ ] Surat pernyataan orisinalitas

## Keamanan

Kata sandi di-hash (bcrypt), sesi JWT 7 hari, rate limit untuk login dan endpoint AI, kuota pembuatan dokumen AI per
akun per hari (`AI_DAILY_LIMIT`), `helmet`, CORS dibatasi, dan konten Markdown dirender tanpa HTML mentah.
