import { ReactNode, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { MathBlock, MathInline } from '../utils/TiptapMath';
import './modul.css';

interface Props {
  nilaiAwal: string;
  onChange: (markdown: string) => void;
  onReady?: (markdown: string) => void;
  onSimpan?: () => void;
}

function rapikan(md: string): string {
  return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function Tombol(props: {
  judul: string;
  onClick: () => void;
  aktif?: boolean;
  nonaktif?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={props.judul}
      aria-label={props.judul}
      aria-pressed={props.aktif}
      disabled={props.nonaktif}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`min-w-8 h-8 px-2 rounded text-sm inline-flex items-center justify-center disabled:opacity-30 ${
        props.aktif ? 'bg-forest-50 text-forest-700 font-semibold' : 'text-ink/70 hover:bg-paper'
      }`}
    >
      {props.children}
    </button>
  );
}

function Pemisah() {
  return <span className="w-px h-5 bg-ink/15 mx-1" aria-hidden="true" />;
}

function Toolbar({ editor, mode, onGantiMode }: { editor: Editor; mode: 'visual' | 'markdown'; onGantiMode: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            tebal: e.isActive('bold'),
            miring: e.isActive('italic'),
            coret: e.isActive('strike'),
            h1: e.isActive('heading', { level: 1 }),
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            daftar: e.isActive('bulletList'),
            daftarBernomor: e.isActive('orderedList'),
            kutipan: e.isActive('blockquote'),
            dalamTabel: e.isActive('table'),
            bisaUndo: e.can().undo(),
            bisaRedo: e.can().redo(),
          }
        : null,
  });

  const visual = mode === 'visual';
  const nonaktif = !visual;

  function tanyaRumus(blok: boolean) {
    const latex = window.prompt(
      blok ? 'Tulis rumus (LaTeX) untuk baris sendiri, contoh: \\frac{a}{b}' : 'Tulis rumus (LaTeX), contoh: x^2 + 1',
      blok ? '' : 'x^2'
    );
    if (!latex || !latex.trim()) return;
    editor
      .chain()
      .focus()
      .insertContent(blok ? { type: 'mathBlock', attrs: { latex: latex.trim() } } : { type: 'mathInline', attrs: { latex: latex.trim(), display: false } })
      .run();
  }

  const nilaiBlok = s?.h1 ? 'h1' : s?.h2 ? 'h2' : s?.h3 ? 'h3' : 'p';

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-ink/10 bg-white px-2 py-1.5 sticky top-0 z-10 rounded-t-lg">
      <Tombol judul="Urungkan (Ctrl+Z)" nonaktif={nonaktif || !s?.bisaUndo} onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </Tombol>
      <Tombol judul="Ulangi (Ctrl+Y)" nonaktif={nonaktif || !s?.bisaRedo} onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </Tombol>
      <Pemisah />

      <select
        aria-label="Gaya paragraf"
        disabled={nonaktif}
        value={nilaiBlok}
        onChange={(e) => {
          const v = e.target.value;
          const c = editor.chain().focus();
          if (v === 'p') c.setParagraph().run();
          else c.setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
        className="h-8 rounded border border-ink/15 bg-white text-sm px-1.5 disabled:opacity-30"
      >
        <option value="p">Paragraf</option>
        <option value="h1">Judul 1</option>
        <option value="h2">Judul 2</option>
        <option value="h3">Judul 3</option>
      </select>
      <Pemisah />

      <Tombol judul="Tebal (Ctrl+B)" aktif={s?.tebal} nonaktif={nonaktif} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Tombol>
      <Tombol judul="Miring (Ctrl+I)" aktif={s?.miring} nonaktif={nonaktif} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </Tombol>
      <Tombol judul="Coret" aktif={s?.coret} nonaktif={nonaktif} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </Tombol>
      <Pemisah />

      <Tombol judul="Daftar poin" aktif={s?.daftar} nonaktif={nonaktif} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • Poin
      </Tombol>
      <Tombol judul="Daftar bernomor" aktif={s?.daftarBernomor} nonaktif={nonaktif} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. Nomor
      </Tombol>
      <Tombol judul="Kutipan" aktif={s?.kutipan} nonaktif={nonaktif} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </Tombol>
      <Tombol judul="Garis pemisah" nonaktif={nonaktif} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        ―
      </Tombol>
      <Pemisah />

      <Tombol
        judul="Sisipkan tabel 3×3"
        nonaktif={nonaktif}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        ▦ Tabel
      </Tombol>
      <Tombol judul="Rumus sebaris (LaTeX)" nonaktif={nonaktif} onClick={() => tanyaRumus(false)}>
        ƒx
      </Tombol>
      <Tombol judul="Rumus satu baris sendiri (LaTeX)" nonaktif={nonaktif} onClick={() => tanyaRumus(true)}>
        ∑ Blok
      </Tombol>

      {visual && s?.dalamTabel && (
        <>
          <Pemisah />
          <span className="text-xs text-ink/50 px-1">Tabel:</span>
          <Tombol judul="Tambah baris di bawah" onClick={() => editor.chain().focus().addRowAfter().run()}>
            + Baris
          </Tombol>
          <Tombol judul="Tambah kolom di kanan" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + Kolom
          </Tombol>
          <Tombol judul="Hapus baris ini" onClick={() => editor.chain().focus().deleteRow().run()}>
            − Baris
          </Tombol>
          <Tombol judul="Hapus kolom ini" onClick={() => editor.chain().focus().deleteColumn().run()}>
            − Kolom
          </Tombol>
          <Tombol judul="Hapus seluruh tabel" onClick={() => editor.chain().focus().deleteTable().run()}>
            <span className="text-red-600">Hapus tabel</span>
          </Tombol>
        </>
      )}

      <button
        type="button"
        onClick={onGantiMode}
        className="ml-auto h-8 px-2.5 rounded border border-ink/15 text-xs text-ink/70 hover:bg-paper"
        title="Tampilkan teks Markdown mentah (untuk pengguna mahir)"
      >
        {visual ? 'Mode Markdown' : '← Kembali ke tampilan biasa'}
      </button>
    </div>
  );
}

export default function ModulEditor({ nilaiAwal, onChange, onReady, onSimpan }: Props) {
  // Callback disimpan di ref agar editor tidak perlu dibuat ulang saat props berubah.
  const refOnChange = useRef(onChange);
  const refOnReady = useRef(onReady);
  const refOnSimpan = useRef(onSimpan);
  refOnChange.current = onChange;
  refOnReady.current = onReady;
  refOnSimpan.current = onSimpan;

  const [mode, setMode] = useState<'visual' | 'markdown'>('visual');
  const [mentah, setMentah] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ underline: false, link: false }),
      Markdown,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      MathInline,
      MathBlock,
    ],
    content: nilaiAwal,
    contentType: 'markdown',
    editorProps: {
      attributes: { class: 'isi-modul', spellcheck: 'true', lang: 'id' },
    },
    onCreate: ({ editor: e }) => refOnReady.current?.(rapikan(e.getMarkdown())),
    onUpdate: ({ editor: e }) => refOnChange.current(rapikan(e.getMarkdown())),
  });

  function gantiMode() {
    if (!editor) return;
    if (mode === 'visual') {
      setMentah(rapikan(editor.getMarkdown()));
      setMode('markdown');
    } else {
      editor.commands.setContent(mentah, { contentType: 'markdown' });
      refOnChange.current(rapikan(editor.getMarkdown()));
      setMode('visual');
    }
  }

  if (!editor) return <p className="text-ink/60">Memuat editor...</p>;

  return (
    <div
      className="rounded-lg border border-ink/10 bg-white focus-within:ring-2 focus-within:ring-forest-400"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          refOnSimpan.current?.();
        }
      }}
    >
      <Toolbar editor={editor} mode={mode} onGantiMode={gantiMode} />

      {mode === 'visual' ? (
        <div className="editor-modul p-5 sm:px-8">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <textarea
          value={mentah}
          onChange={(e) => {
            setMentah(e.target.value);
            refOnChange.current(e.target.value);
          }}
          rows={26}
          spellCheck={false}
          className="w-full rounded-b-lg p-4 text-sm font-mono leading-relaxed focus:outline-none"
          aria-label="Markdown mentah"
        />
      )}
    </div>
  );
}
