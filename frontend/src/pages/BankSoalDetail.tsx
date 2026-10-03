import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { loadGoogleIdentity, requestGoogleAccessToken } from '../api/googleAuth';
import { AsesmenSet } from '../types';
import MathText from '../components/MathText';

type FormatEkspor = 'kahoot' | 'lengkap';

interface HasilGoogleForm {
  formId: string;
  responderUri: string;
  editUrl: string;
  jumlahSoal: number;
  soalDilewati: number;
  bisaDiisiSiapaSaja: boolean;
  dibuatPada: string;
}

function formatTanggal(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BankSoalDetail() {
  const { id } = useParams();
  const [set, setSet] = useState<AsesmenSet | null>(null);
  const [exporting, setExporting] = useState<FormatEkspor | 'google' | null>(null);
  const [googleForm, setGoogleForm] = useState<HasilGoogleForm | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    client.get(`/bank-soal/${id}`).then((res) => setSet(res.data.asesmenSet));
  }, [id]);

  // Muat script Google lebih awal supaya popup login tidak diblokir browser.
  useEffect(() => {
    loadGoogleIdentity().catch(() => {
      /* ditangani saat tombol Google diklik */
    });
  }, []);

  async function handleExport(format: FormatEkspor) {
    if (!id) return;
    setExporting(format);
    try {
      const res = await client.get(`/bank-soal/${id}/export`, {
        params: { format },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${set?.judul || 'soal'}-${format}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const bermasalah = Number(res.headers['x-soal-melebihi-batas'] ?? 0);
      if (format === 'kahoot' && bermasalah > 0) {
        alert(
          `${bermasalah} soal melebihi batas karakter Kahoot (soal 120, jawaban 75). ` +
            `Sel-nya diberi warna merah di Excel — persingkat dulu sebelum diunggah ke Kahoot.`
        );
      }
    } finally {
      setExporting(null);
    }
  }

  async function handleGoogleForm() {
    if (!id || !set) return;
    if (
      set.googleFormUrl &&
      !window.confirm(
        'Set soal ini sudah pernah dibuatkan Google Form. Buat form BARU? ' +
          'Form lama tetap ada di Google Drive Anda, tetapi link yang tersimpan di sini akan diganti.'
      )
    ) {
      return;
    }
    setExporting('google');
    setGoogleError(null);
    setGoogleForm(null);
    try {
      const accessToken = await requestGoogleAccessToken();
      const res = await client.post(`/bank-soal/${id}/google-form`, { accessToken });
      const hasil: HasilGoogleForm = res.data;
      setGoogleForm(hasil);
      setSet({
        ...set,
        googleFormId: hasil.formId,
        googleFormUrl: hasil.responderUri,
        googleFormEditUrl: hasil.editUrl,
        googleFormDibuatPada: hasil.dibuatPada,
      });
    } catch (err: any) {
      setGoogleError(err?.response?.data?.error || err?.message || 'Gagal membuat Google Form.');
    } finally {
      setExporting(null);
    }
  }

  if (!set) return <p className="text-ink/60">Memuat...</p>;

  const sibuk = exporting !== null;

  return (
    <div>
      <div className="flex items-start justify-between mb-1 gap-4">
        <h1 className="text-2xl font-semibold">{set.judul}</h1>
        <div className="shrink-0 flex flex-wrap justify-end gap-2">
          <button
            onClick={handleGoogleForm}
            disabled={sibuk}
            className="rounded-md bg-forest-700 text-white text-sm px-4 py-2 hover:bg-forest-800 disabled:opacity-50"
          >
            {exporting === 'google' ? 'Membuat form...' : set.googleFormUrl ? 'Buat ulang Google Form' : 'Buat Google Form'}
          </button>
          <button
            onClick={() => handleExport('kahoot')}
            disabled={sibuk}
            className="rounded-md border border-forest-700 text-forest-700 text-sm px-4 py-2 hover:bg-forest-50 disabled:opacity-50"
          >
            {exporting === 'kahoot' ? 'Menyiapkan...' : 'Unduh untuk Kahoot'}
          </button>
          <button
            onClick={() => handleExport('lengkap')}
            disabled={sibuk}
            className="rounded-md border border-forest-700 text-forest-700 text-sm px-4 py-2 hover:bg-forest-50 disabled:opacity-50"
          >
            {exporting === 'lengkap' ? 'Menyiapkan...' : 'Excel lengkap'}
          </button>
        </div>
      </div>
      <p className="text-ink/60 mb-1">
        {set.mapel} · Kelas {set.kelas} · {set.soal.length} soal
      </p>
      <p className="text-xs text-ink/40 mb-4">
        "Buat Google Form" membuat kuis lengkap dengan kunci jawaban dan pembahasan di Google Drive Anda.
        "Unduh untuk Kahoot" menghasilkan file template impor Kahoot (Add question → Import spreadsheet).
        "Excel lengkap" berisi pembahasan untuk arsip atau cetak.
      </p>

      {googleError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm p-3">{googleError}</div>
      )}

      {set.googleFormUrl && (
        <div className="mb-4 rounded-md border border-forest-700/30 bg-forest-50 text-sm p-4 space-y-2">
          <p className="font-medium text-forest-700">
            {googleForm ? 'Google Form berhasil dibuat' : 'Google Form sudah dibuat'}
            {googleForm ? ` (${googleForm.jumlahSoal} soal` : ''}
            {googleForm && googleForm.soalDilewati > 0
              ? `, ${googleForm.soalDilewati} soal dilewati karena data tidak valid`
              : ''}
            {googleForm ? ')' : ''}
            {set.googleFormDibuatPada && (
              <span className="font-normal text-ink/60"> · {formatTanggal(set.googleFormDibuatPada)}</span>
            )}
          </p>
          <p>
            Link untuk siswa:{' '}
            <a href={set.googleFormUrl} target="_blank" rel="noreferrer" className="underline break-all">
              {set.googleFormUrl}
            </a>{' '}
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(set.googleFormUrl!)}
              className="ml-1 text-xs rounded border border-forest-700/40 px-2 py-0.5 hover:bg-white"
            >
              Salin
            </button>
          </p>
          {set.googleFormEditUrl && (
            <p>
              <a href={set.googleFormEditUrl} target="_blank" rel="noreferrer" className="underline">
                Buka di Google Forms untuk mengedit
              </a>
            </p>
          )}
          {googleForm && !googleForm.bisaDiisiSiapaSaja && (
            <p className="text-ink/70">
              Catatan: akses pengisian belum otomatis dibuka untuk "siapa saja yang punya link". Di Google Forms,
              klik <b>Kirim</b> lalu atur siapa yang boleh mengisi sebelum membagikan link.
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {set.soal.map((s, i) => (
          <div key={s.id} className="bg-white rounded-lg border border-ink/10 p-5">
            <p className="font-medium mb-3">
              {i + 1}. <MathText>{s.pertanyaan}</MathText>
            </p>
            {s.pilihanJawaban && (
              <ul className="space-y-1 mb-3">
                {s.pilihanJawaban.map((opt, idx) => (
                  <li
                    key={idx}
                    className={`text-sm px-3 py-1.5 rounded-md ${
                      opt === s.kunciJawaban ? 'bg-forest-50 text-forest-700 font-medium' : 'text-ink/70'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}. <MathText>{opt}</MathText>
                  </li>
                ))}
              </ul>
            )}
            {s.pembahasan && (
              <p className="text-sm text-ink/60 border-t border-ink/10 pt-3">
                <MathText>{s.pembahasan}</MathText>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
