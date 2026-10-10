import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx';
import { latexToText } from './latexToText';
import type { SetUntukEkspor } from './excel';

// pembaca sederhana: judul, daftar, tabel, kutipan, garis, serta tebal / miring / kode / rumus di dalam baris.
// Rumus LaTeX diubah ke teks Unicode (Word tidak merender LaTeX), sama seperti ekspor Excel.

const FONT = 'Calibri';
const UKURAN = 22; // setengah poin -> 11 pt

const HEADING = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_4,
];

type Gaya = { bold?: boolean; italics?: boolean };

/** "1." + tab (elemen tab sungguhan, bukan karakter tab di dalam teks). */
const label = (teks: string) => new TextRun({ children: [teks, new Tab()] });

const run = (text: string, gaya: Gaya & { code?: boolean } = {}) =>
  new TextRun({ text, bold: gaya.bold, italics: gaya.italics, font: gaya.code ? 'Consolas' : undefined });

// Rumus ($...$ atau $$...$$) -> teks biasa. Hanya segmen rumus yang diubah, supaya teks lain tidak ikut disentuh.
const POLA_RUMUS = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g;
export const rumusKeTeks = (s: string) => s.replace(POLA_RUMUS, (m) => latexToText(m));

const POLA_INLINE = /(\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|`[^`\n]+`|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

/** Satu baris Markdown -> deretan TextRun. */
export function inline(teks: string, dasar: Gaya = {}): TextRun[] {
  const hasil: TextRun[] = [];
  for (const bagian of teks.split(POLA_INLINE)) {
    if (!bagian) continue;
    if (bagian.startsWith('**') && bagian.endsWith('**') && bagian.length > 4) {
      hasil.push(...inline(bagian.slice(2, -2), { ...dasar, bold: true }));
    } else if (bagian.startsWith('*') && bagian.endsWith('*') && bagian.length > 2) {
      hasil.push(...inline(bagian.slice(1, -1), { ...dasar, italics: true }));
    } else if (bagian.startsWith('`') && bagian.endsWith('`') && bagian.length > 2) {
      hasil.push(run(bagian.slice(1, -1), { ...dasar, code: true }));
    } else if (bagian.startsWith('$')) {
      hasil.push(run(latexToText(bagian), dasar));
    } else {
      hasil.push(run(bagian, dasar));
    }
  }
  return hasil;
}

const jarakParagraf = { after: 120 };

const barisTabel = (baris: string) =>
  baris
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

const adalahPemisahTabel = (baris: string | undefined) => !!baris && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(baris) && baris.includes('-');

const GARIS = { style: BorderStyle.SINGLE, size: 4, color: '999999' };

function buatTabel(baris: string[][]): Table {
  const kolom = Math.max(...baris.map((b) => b.length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: GARIS, bottom: GARIS, left: GARIS, right: GARIS, insideHorizontal: GARIS, insideVertical: GARIS },
    rows: baris.map(
      (sel, r) =>
        new TableRow({
          tableHeader: r === 0,
          cantSplit: true,
          children: Array.from({ length: kolom }, (_, c) =>
            new TableCell({
              shading: r === 0 ? { type: ShadingType.CLEAR, fill: 'EFF3F0', color: 'auto' } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ children: inline(sel[c] ?? '', r === 0 ? { bold: true } : {}) })],
            })
          ),
        })
    ),
  });
}

/** Markdown -> blok dokumen Word. */
export function markdownKeBlok(md: string): (Paragraph | Table)[] {
  const baris = md.replace(/\r\n?/g, '\n').split('\n');
  const blok: (Paragraph | Table)[] = [];
  let paragraf: string[] = [];

  const tutupParagraf = () => {
    if (paragraf.length) blok.push(new Paragraph({ children: inline(paragraf.join(' ')), spacing: jarakParagraf }));
    paragraf = [];
  };

  for (let i = 0; i < baris.length; i++) {
    const b = baris[i];
    const rapi = b.trim();

    if (!rapi) {
      tutupParagraf();
      continue;
    }

    // Persamaan tersendiri $$ ... $$ (boleh beberapa baris)
    if (rapi.startsWith('$$')) {
      tutupParagraf();
      let isi = rapi;
      while (!(isi.length > 2 && isi.endsWith('$$')) && i + 1 < baris.length) isi += `\n${baris[++i]}`;
      blok.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(rumusKeTeks(isi))], spacing: jarakParagraf }));
      continue;
    }

    const judul = /^(#{1,6})\s+(.*?)\s*#*$/.exec(rapi);
    if (judul) {
      tutupParagraf();
      blok.push(new Paragraph({ heading: HEADING[judul[1].length], children: inline(judul[2]), spacing: { before: 200, after: 100 } }));
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(rapi)) {
      tutupParagraf();
      blok.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, spacing: jarakParagraf }));
      continue;
    }

    if (rapi.startsWith('|') && adalahPemisahTabel(baris[i + 1])) {
      tutupParagraf();
      const isi = [barisTabel(rapi)];
      i += 2;
      while (i < baris.length && baris[i].trim().startsWith('|')) isi.push(barisTabel(baris[i++]));
      i--;
      blok.push(buatTabel(isi));
      blok.push(new Paragraph({ spacing: jarakParagraf }));
      continue;
    }

    const butir = /^(\s*)[-*+]\s+(.*)/.exec(b);
    if (butir) {
      tutupParagraf();
      const tingkat = Math.min(2, Math.floor(butir[1].replace(/\t/g, '  ').length / 2));
      blok.push(new Paragraph({ children: inline(butir[2]), bullet: { level: tingkat }, spacing: { after: 60 } }));
      continue;
    }

    const nomor = /^(\s*)(\d+)[.)]\s+(.*)/.exec(b);
    if (nomor) {
      tutupParagraf();
      const geser = Math.min(2, Math.floor(nomor[1].replace(/\t/g, '  ').length / 2)) * 360;
      blok.push(
        new Paragraph({
          children: [label(`${nomor[2]}.`), ...inline(nomor[3])],
          indent: { left: 360 + geser, hanging: 360 },
          tabStops: [{ type: TabStopType.LEFT, position: 360 + geser }],
          spacing: { after: 60 },
        })
      );
      continue;
    }

    const kutipan = /^>\s?(.*)/.exec(rapi);
    if (kutipan) {
      tutupParagraf();
      blok.push(new Paragraph({ children: inline(kutipan[1], { italics: true }), indent: { left: 400 }, spacing: jarakParagraf }));
      continue;
    }

    paragraf.push(rapi);
  }
  tutupParagraf();
  return blok;
}

function dokumen(isi: (Paragraph | Table)[]): Document {
  return new Document({
    creator: 'Ajarin',
    styles: { default: { document: { run: { font: FONT, size: UKURAN } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: isi }],
  });
}

const judulDokumen = (teks: string) =>
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: teks, bold: true })], spacing: { after: 120 } });

const keterangan = (teks: string) => new Paragraph({ children: [new TextRun({ text: teks, color: '666666' })], spacing: { after: 200 } });

export async function wordModul(m: {
  judul: string;
  topik: string;
  jenjang: string;
  kelas: string;
  alokasiWaktu: string;
  konten: string;
}): Promise<Buffer> {
  const isi = [
    judulDokumen(m.judul),
    keterangan(`${m.topik} · ${m.jenjang} kelas ${m.kelas} · ${m.alokasiWaktu}`),
    ...markdownKeBlok(m.konten),
  ];
  return Packer.toBuffer(dokumen(isi));
}

const HURUF = ['A', 'B', 'C', 'D'];
const pilihanArray = (p: unknown): string[] => (Array.isArray(p) ? p.map(String) : []);

/** Lembar soal untuk siswa, lalu halaman baru berisi kunci jawaban dan pembahasan untuk guru. */
export async function wordSoal(set: SetUntukEkspor): Promise<Buffer> {
  const isi: (Paragraph | Table)[] = [
    judulDokumen(set.judul),
    keterangan(`${set.mapel} · kelas ${set.kelas} · ${set.butir.length} soal`),
    new Paragraph({ children: [run('Nama: ______________________________     Kelas: __________     Nilai: ________')], spacing: { after: 240 } }),
    new Paragraph({ children: [run('Pilihlah satu jawaban yang paling tepat.', { italics: true })], spacing: { after: 200 } }),
  ];

  set.butir.forEach((b, n) => {
    isi.push(
      new Paragraph({
        children: [label(`${n + 1}.`), ...inline(b.pertanyaan)],
        indent: { left: 460, hanging: 460 },
        keepNext: true,
        spacing: { before: 120, after: 60 },
      })
    );
    pilihanArray(b.pilihan).forEach((p, i) => {
      isi.push(
        new Paragraph({
          children: [label(`${HURUF[i]}.`), ...inline(p)],
          indent: { left: 920, hanging: 460 },
          keepLines: true,
          spacing: { after: 30 },
        })
      );
    });
  });

  isi.push(
    new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [run('Kunci Jawaban dan Pembahasan')], spacing: { after: 160 } })
  );
  set.butir.forEach((b, n) => {
    isi.push(
      new Paragraph({
        children: [run(`${n + 1}.  Jawaban ${HURUF[b.kunci] ?? '?'}`, { bold: true })],
        keepNext: true,
        spacing: { before: 120, after: 40 },
      }),
      new Paragraph({ children: inline(b.pembahasan), indent: { left: 460 }, spacing: { after: 80 } })
    );
  });

  return Packer.toBuffer(dokumen(isi));
}
