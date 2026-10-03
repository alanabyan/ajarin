// Meminta access token Google (popup login/izin) lewat Google Identity Services.
// Token dipakai sekali oleh backend untuk membuat Google Form di Drive guru; tidak disimpan.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// forms.body   : membuat & mengedit form
// drive.file   : (opsional) mengizinkan "siapa saja yang punya link" mengisi form
const SCOPE_FORMS = 'https://www.googleapis.com/auth/forms.body';
const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file';

let gsiPromise: Promise<void> | null = null;

// Panggil sekali saat halaman dibuka (useEffect), supaya popup login tidak diblokir browser
// karena script baru dimuat setelah klik.
export function loadGoogleIdentity(): Promise<void> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error('Gagal memuat Google Identity Services. Periksa koneksi internet.'));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

export function requestGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      return reject(new Error('VITE_GOOGLE_CLIENT_ID belum diatur di file .env frontend.'));
    }
    const oauth2 = (window as any).google?.accounts?.oauth2;
    if (!oauth2) {
      return reject(new Error('Google belum siap. Muat ulang halaman lalu coba lagi.'));
    }

    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: `${SCOPE_FORMS} ${SCOPE_DRIVE}`,
      callback: (resp: any) => {
        if (resp.error) {
          return reject(new Error(resp.error_description || resp.error));
        }
        // Pengguna bisa menghapus centang izin satu per satu; izin Forms wajib ada.
        if (!oauth2.hasGrantedAllScopes(resp, SCOPE_FORMS)) {
          return reject(new Error('Izin Google Forms tidak diberikan. Centang izin yang diminta lalu coba lagi.'));
        }
        resolve(resp.access_token);
      },
      error_callback: (err: any) => {
        reject(
          new Error(
            err?.type === 'popup_closed'
              ? 'Jendela login Google ditutup.'
              : err?.type === 'popup_failed_to_open'
                ? 'Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.'
                : 'Gagal login ke Google.'
          )
        );
      },
    });

    client.requestAccessToken();
  });
}