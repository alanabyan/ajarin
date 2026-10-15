import nodemailer, { Transporter } from 'nodemailer';
import { HttpError } from '../lib/http';

// Email dikirim lewat SMTP. Untuk Gmail: aktifkan verifikasi 2 langkah di akun Google, buat "App Password",
// lalu isi SMTP_USER (alamat Gmail) dan SMTP_PASS (app password 16 huruf). Host/port bawaan sudah untuk Gmail.
let transporter: Transporter | null = null;

function siapkan(): Transporter | null {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

/** Alamat frontend untuk tautan di email: APP_URL, atau origin pertama di CLIENT_URL. */
export function urlAplikasi(): string {
  const dari = process.env.APP_URL || (process.env.CLIENT_URL ?? '').split(',')[0] || 'http://localhost:5173';
  return dari.trim().replace(/\/+$/, '');
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function kirimEmailVerifikasi(ke: string, nama: string, token: string): Promise<void> {
  const tautan = `${urlAplikasi()}/verifikasi?token=${encodeURIComponent(token)}`;
  const t = siapkan();
  if (!t) {
    // Tanpa SMTP di lingkungan pengembangan: tautan dicetak di konsol supaya alur tetap bisa diuji.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email] SMTP belum diatur. Tautan verifikasi untuk ${ke}:\n${tautan}`);
      return;
    }
    throw new HttpError(500, 'Layanan email belum diatur di server. Hubungi admin.');
  }

  const sapaan = escape(nama.split(/\s+/)[0] || nama);
  await t.sendMail({
    from: process.env.MAIL_FROM || `Ajarin <${process.env.SMTP_USER}>`,
    to: ke,
    subject: 'Verifikasi email akun Ajarin',
    text:
      `Halo ${nama},\n\nTerima kasih sudah mendaftar di Ajarin. Buka tautan berikut untuk memverifikasi email Anda ` +
      `(berlaku 24 jam):\n\n${tautan}\n\nAbaikan email ini bila Anda tidak merasa mendaftar.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1D1C56">
  <h2 style="color:#5350F7">Verifikasi email Anda</h2>
  <p>Halo ${sapaan},</p>
  <p>Terima kasih sudah mendaftar di <b>Ajarin</b>. Klik tombol di bawah untuk memverifikasi email Anda. Tautan berlaku 24 jam.</p>
  <p style="margin:28px 0"><a href="${escape(tautan)}" style="background:#5350F7;color:#fff;padding:12px 22px;border-radius:21px;text-decoration:none;font-weight:bold">Verifikasi email</a></p>
  <p style="font-size:13px;color:#6F6F89">Bila tombol tidak berfungsi, salin tautan ini ke browser:<br><a href="${escape(tautan)}">${escape(tautan)}</a></p>
  <p style="font-size:13px;color:#6F6F89">Abaikan email ini bila Anda tidak merasa mendaftar.</p>
</div>`,
  });
}
