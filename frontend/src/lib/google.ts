// Meminta access token Google (popup izin) lewat Google Identity Services.
// Token hanya dipakai sekali oleh backend untuk membuat form / membaca jawaban, dan tidak disimpan.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const SCOPE_FORM = 'https://www.googleapis.com/auth/forms.body';
const SCOPE_JAWABAN = 'https://www.googleapis.com/auth/forms.responses.readonly';
const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file'; // opsional: buka akses "siapa saja dengan link"

let promise: Promise<void> | null = null;

// Panggil saat halaman dibuka agar popup tidak diblokir browser (script sudah termuat sebelum klik).
export function muatGoogle(): Promise<void> {
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      promise = null;
      reject(new Error('Gagal memuat layanan Google. Periksa koneksi internet.'));
    };
    document.head.appendChild(s);
  });
  return promise;
}

export function mintaTokenGoogle(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) return reject(new Error('VITE_GOOGLE_CLIENT_ID belum diatur.'));
    const oauth2 = (window as any).google?.accounts?.oauth2;
    if (!oauth2) return reject(new Error('Layanan Google belum siap. Muat ulang halaman lalu coba lagi.'));

    oauth2
      .initTokenClient({
        client_id: CLIENT_ID,
        scope: `${SCOPE_FORM} ${SCOPE_JAWABAN} ${SCOPE_DRIVE}`,
        callback: (resp: any) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          if (!oauth2.hasGrantedAllScopes(resp, SCOPE_FORM, SCOPE_JAWABAN)) {
            return reject(new Error('Izin Google Forms belum lengkap. Centang semua izin yang diminta lalu coba lagi.'));
          }
          resolve(resp.access_token);
        },
        error_callback: (err: any) =>
          reject(
            new Error(
              err?.type === 'popup_closed'
                ? 'Jendela Google ditutup.'
                : err?.type === 'popup_failed_to_open'
                  ? 'Popup diblokir browser. Izinkan popup untuk situs ini.'
                  : 'Gagal terhubung ke Google.'
            )
          ),
      })
      .requestAccessToken();
  });
}
