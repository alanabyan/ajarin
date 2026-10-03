import { Node } from '@tiptap/core';
import katex from 'katex';

// Rumus LaTeX di editor modul ajar.
//  - Di Markdown (database)  : $x^2$ (sebaris) dan $$...$$ (baris sendiri) — sama seperti sebelumnya.
//  - Di editor               : tampil sebagai rumus (KaTeX); klik dua kali untuk mengubah teks LaTeX-nya.
// Dibuat sebagai "atom" supaya karakter seperti \ _ * di dalam rumus tidak dirusak oleh Markdown.

function tampilkanRumus(el: HTMLElement, latex: string, display: boolean) {
  el.innerHTML = '';
  if (!latex.trim()) {
    el.textContent = display ? '[rumus kosong]' : '[rumus]';
    el.classList.add('math-kosong');
    return;
  }
  el.classList.remove('math-kosong');
  try {
    katex.render(latex, el, { throwOnError: false, displayMode: display });
  } catch {
    el.textContent = display ? `$$${latex}$$` : `$${latex}$`;
  }
}

function buatNodeView(display: boolean) {
  return ({ node, editor, getPos }: any) => {
    let sekarang = node;
    let mengedit = false;

    const dom = document.createElement(display ? 'div' : 'span');
    dom.className = display ? 'math-blok' : 'math-inline';
    dom.setAttribute('data-math', '');
    dom.title = 'Klik dua kali untuk mengubah rumus';

    const hasil = document.createElement(display ? 'div' : 'span');
    dom.appendChild(hasil);
    tampilkanRumus(hasil, sekarang.attrs.latex, display);

    function selesai(input: HTMLInputElement | HTMLTextAreaElement, simpan: boolean) {
      if (!mengedit) return;
      mengedit = false;
      const nilai = input.value.trim();
      if (simpan && nilai !== sekarang.attrs.latex) {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (pos !== undefined) {
          editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...sekarang.attrs, latex: nilai }));
        }
      }
      tampilkanRumus(hasil, simpan ? nilai : sekarang.attrs.latex, display);
      dom.replaceChildren(hasil);
      editor.view.focus();
    }

    function mulaiEdit() {
      if (mengedit || !editor.isEditable) return;
      mengedit = true;
      const input = document.createElement(display ? 'textarea' : 'input') as HTMLInputElement | HTMLTextAreaElement;
      input.value = sekarang.attrs.latex;
      input.className = 'math-input';
      input.setAttribute('aria-label', 'Teks LaTeX rumus');
      input.spellcheck = false;
      if (display) (input as HTMLTextAreaElement).rows = 3;
      dom.replaceChildren(input);
      input.focus();
      input.select();

      input.addEventListener('keydown', (ev: Event) => {
        const e = ev as KeyboardEvent;
        e.stopPropagation();
        const ctrl = e.ctrlKey || e.metaKey;
        if (e.key === 'Enter' && (!display || ctrl)) {
          e.preventDefault();
          selesai(input, true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          selesai(input, false);
        }
      });
      input.addEventListener('blur', () => selesai(input, true));
    }

    dom.addEventListener('dblclick', mulaiEdit);

    return {
      dom,
      update(baru: any) {
        if (baru.type !== sekarang.type) return false;
        sekarang = baru;
        if (!mengedit) {
          tampilkanRumus(hasil, sekarang.attrs.latex, display);
          dom.replaceChildren(hasil);
        }
        return true;
      },
      stopEvent: (e: Event) => mengedit && dom.contains(e.target as globalThis.Node),
      ignoreMutation: () => true,
      selectNode: () => dom.classList.add('math-dipilih'),
      deselectNode: () => dom.classList.remove('math-dipilih'),
    };
  };
}

// ---- Rumus sebaris: $x^2$ (atau $$x^2$$ di tengah kalimat) ----
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: '' },
      display: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math-inline]',
        getAttrs: (el) => ({
          latex: (el as HTMLElement).getAttribute('data-latex') ?? '',
          display: (el as HTMLElement).getAttribute('data-display') === 'true',
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'span',
      { 'data-math-inline': '', 'data-latex': node.attrs.latex, 'data-display': String(!!node.attrs.display) },
      node.attrs.display ? `$$${node.attrs.latex}$$` : `$${node.attrs.latex}$`,
    ];
  },

  addNodeView() {
    return buatNodeView(false);
  },

  markdownTokenName: 'mathInline',

  markdownTokenizer: {
    name: 'mathInline',
    level: 'inline',
    start: (src: string) => src.indexOf('$'),
    tokenize: (src: string) => {
      const dua = /^\$\$((?:\\.|[^$\\\n])+?)\$\$/.exec(src);
      if (dua) return { type: 'mathInline', raw: dua[0], latex: dua[1].trim(), display: true };
      const satu = /^\$(?!\s)((?:\\.|[^$\\\n])+?)(?<!\s)\$(?!\d)/.exec(src);
      if (satu) return { type: 'mathInline', raw: satu[0], latex: satu[1], display: false };
      return undefined;
    },
  },

  parseMarkdown: (token: any, helpers: any) =>
    helpers.createNode('mathInline', { latex: token.latex ?? '', display: !!token.display }),

  renderMarkdown: (node: any) => {
    const latex = node.attrs?.latex ?? '';
    return node.attrs?.display ? `$$${latex}$$` : `$${latex}$`;
  },
});

// ---- Rumus satu blok: baris sendiri $$ ... $$ ----
export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return { latex: { default: '' } };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math-block]',
        getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute('data-latex') ?? '' }),
      },
    ];
  },

  renderHTML({ node }) {
    return ['div', { 'data-math-block': '', 'data-latex': node.attrs.latex }, `$$${node.attrs.latex}$$`];
  },

  addNodeView() {
    return buatNodeView(true);
  },

  markdownTokenName: 'mathBlock',

  markdownTokenizer: {
    name: 'mathBlock',
    level: 'block',
    start: (src: string) => src.indexOf('$$'),
    tokenize: (src: string) => {
      const m = /^\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$[ \t]*(?:\n|$)/.exec(src);
      if (!m) return undefined;
      return { type: 'mathBlock', raw: m[0], latex: m[1].trim() };
    },
  },

  parseMarkdown: (token: any, helpers: any) => helpers.createNode('mathBlock', { latex: token.latex ?? '' }),

  renderMarkdown: (node: any) => `$$\n${node.attrs?.latex ?? ''}\n$$`,
});