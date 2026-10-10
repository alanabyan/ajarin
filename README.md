# Ajarin

**Penerang jalan guru mengajar.** Platform untuk guru honorer: menyusun modul ajar, membuat bank soal,
membagikannya sebagai kuis Google Form / Kahoot, lalu merekap nilai dan melihat materi yang belum dikuasai siswa.

Karya lomba Web Development ITASE 7.0, tema **SDG 4: Quality Education** (target 4.c, guru berkualitas).

## Fitur

| Fitur | Keterangan |
| --- | --- |
| Modul ajar (AI) | Draf Kurikulum Merdeka dari topik dan tujuan pembelajaran, tampil bertahap saat AI menulis; sunting dengan pratinjau Markdown + rumus KaTeX; cetak / simpan PDF atau unduh Word (.docx) |
| Bank soal (AI) | Soal pilihan ganda + kunci + pembahasan; AI mengerjakan ulang tiap soal dan menandai kunci yang meragukan; soal bisa dikoreksi guru; ekspor Word (lembar soal + kunci), Excel, dan template Kahoot |
| Google Form | Kuis otomatis (mode quiz) di Drive guru; soal pertama berupa dropdown nama siswa kelas, jadi siswa tinggal memilih namanya |
| Impor nilai | Jawaban otomatis terhubung ke siswa lewat dropdown nama; daftar siswa yang belum mengisi ditampilkan; impor ulang memperbarui, tidak menggandakan |
| Analisis butir soal | Persentase siswa yang benar per soal, dengan daftar materi yang perlu diulang |
| Dampak & peta belajar | Halaman bukti dampak: peta materi (mana yang belum dikuasai), tren rata-rata kelas, siswa yang perlu perhatian, dan perubahan nilai sebelum / sesudah remedial; bisa dicetak |
| Mode offline (PWA) | Bisa dipasang di layar utama dan dibuka tanpa internet. Modul, soal, kelas, rekap, rapor, dan halaman Dampak yang sudah dimuat tetap bisa dibaca dan dicetak. Data disimpan per akun di perangkat dan dihapus saat keluar. Membuat dengan AI, menyimpan, impor nilai, dan unduhan butuh internet (tombolnya dinonaktifkan dengan penjelasan) |
| Panduan awal | Checklist 4 langkah untuk guru baru; akun demo menampilkan jalur singkat untuk juri |
| Soal remedial | Satu klik dari analisis: soal baru untuk konsep yang lemah, bisa khusus siswa di bawah KKM (dropdown form hanya memuat nama mereka) |
| Kelas & nilai | KKM per kelas, impor siswa dari Excel / CSV (atau tempel), rekap nilai, penanda tuntas / remedial, ekspor Excel |
| Akun demo | Satu klik tanpa daftar, berisi data contoh (untuk juri) |

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
cp .env.example .env        # isi DATABASE_URL, JWT_SECRET, GROQ_API_KEY
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
- [ ] Hosting publik (Vercel), tautan dimasukkan ke proposal
- [ ] Repository publik (GitHub / GitLab)
- [ ] Proposal PDF (maks. 30 halaman) dan video YouTube (maks. 3 menit) sesuai ketentuan panitia
- [ ] Surat pernyataan orisinalitas

## Keamanan

Kata sandi di-hash (bcrypt), sesi JWT 7 hari, rate limit untuk login dan endpoint AI, kuota pembuatan dokumen AI per
akun per hari (`AI_DAILY_LIMIT`), `helmet`, CORS dibatasi, dan konten Markdown dirender tanpa HTML mentah.
