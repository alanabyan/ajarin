// Mengubah teks yang berisi LaTeX ($...$ / $$...$$) menjadi teks biasa berbasis Unicode
// supaya terbaca di Excel (yang tidak bisa merender LaTeX).
// Contoh: "$\frac{1}{10}\begin{pmatrix}6 & -7\\ -2 & 4\end{pmatrix}$" -> "1/10(6, -7; -2, 4)"

const SYMBOLS: Record<string, string> = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥',
  ne: '≠', neq: '≠', approx: '≈', equiv: '≡', sim: '∼', propto: '∝', infty: '∞',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒',
  Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⇒', iff: '⇔', mapsto: '↦',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇',
  cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅', forall: '∀', exists: '∃',
  sum: 'Σ', prod: '∏', int: '∫', oint: '∮', partial: '∂', nabla: '∇',
  degree: '°', circ: '°', ldots: '…', cdots: '…', dots: '…', vdots: '⋮',
  angle: '∠', perp: '⊥', parallel: '∥', therefore: '∴', because: '∵',
  neg: '¬', land: '∧', lor: '∨', prime: '′', star: '*', ast: '*', bullet: '•',
  lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', langle: '⟨', rangle: '⟩',
  // spasi
  quad: ' ', qquad: '  ', ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ',
  // simbol escape
  '%': '%', '&': '&', '#': '#', _: '_', $: '$',
  // huruf Yunani
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
  Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

// Nama fungsi: cukup ditulis tanpa backslash.
const FUNCTIONS = new Set([
  'det', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh',
  'tanh', 'log', 'ln', 'lim', 'min', 'max', 'exp', 'gcd', 'lcm', 'mod', 'dim', 'ker', 'rank',
  'tr', 'sup', 'inf', 'arg', 'deg',
]);

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸',
  '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', T: 'ᵀ',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈',
  '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', o: 'ₒ',
  x: 'ₓ', h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', p: 'ₚ', s: 'ₛ', t: 'ₜ', i: 'ᵢ', j: 'ⱼ',
  r: 'ᵣ', u: 'ᵤ', v: 'ᵥ',
};
const BLACKBOARD: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' };

const OPEN_BRACE = '\u0001';
const CLOSE_BRACE = '\u0002';

const MATRIX_DELIMS: Record<string, [string, string]> = {
  p: ['(', ')'],
  b: ['[', ']'],
  B: ['{', '}'],
  v: ['|', '|'],
  V: ['‖', '‖'],
  '': ['[', ']'],
};

function isSimple(s: string): boolean {
  return s.length <= 1 || /^[\w.]+$/.test(s);
}

function wrap(s: string): string {
  return isSimple(s) ? s : `(${s})`;
}

function mapAll(s: string, table: Record<string, string>): string | null {
  let out = '';
  for (const ch of s) {
    if (!(ch in table)) return null;
    out += table[ch];
  }
  return out;
}

// Baca satu argumen: {...} berimbang, atau satu token (karakter / perintah).
function readArg(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (i >= s.length) return ['', i];
  if (s[i] === '{') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') {
        depth--;
        if (depth === 0) return [s.slice(i + 1, j), j + 1];
      }
    }
    return [s.slice(i + 1), s.length];
  }
  if (s[i] === '\\') {
    const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
    if (m) return [m[0], i + m[0].length];
  }
  return [s[i], i + 1];
}

function convertEnvironments(s: string): string {
  // matriks: pmatrix, bmatrix, vmatrix, Vmatrix, Bmatrix, matrix
  s = s.replace(
    /\\begin\{([pbvVB]?)matrix\}([\s\S]*?)\\end\{\1matrix\}/g,
    (_m, kind: string, body: string) => {
      const [open, close] = MATRIX_DELIMS[kind] ?? MATRIX_DELIMS[''];
      const rows = body
        .split(/\\\\/)
        .map((r) => r.trim())
        .filter((r) => r.length > 0)
        .map((r) =>
          r
            .split('&')
            .map((c) => convert(c.trim()))
            .join(', ')
        );
      return `${open}${rows.join('; ')}${close}`;
    }
  );

  // sistem persamaan
  s = s.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_m, body: string) => {
    const rows = body
      .split(/\\\\/)
      .map((r) => r.replace(/&/g, ' ').trim())
      .filter((r) => r.length > 0)
      .map((r) => convert(r));
    return `{ ${rows.join('; ')} }`;
  });

  // aligned / align / array: ratakan saja
  s = s.replace(
    /\\begin\{(?:aligned|align\*?|array|gathered|split)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:aligned|align\*?|array|gathered|split)\}/g,
    (_m, body: string) => {
      const rows = body
        .split(/\\\\/)
        .map((r) => r.replace(/&/g, ' ').trim())
        .filter((r) => r.length > 0)
        .map((r) => convert(r));
      return rows.join('; ');
    }
  );

  return s;
}

function convert(input: string): string {
  let s = input;
  s = s.replace(/\\left\s*\./g, '').replace(/\\right\s*\./g, '');
  s = s.replace(/\\left|\\right|\\big|\\Big|\\bigg|\\Bigg/g, '');
  s = s.replace(/\\\{/g, OPEN_BRACE).replace(/\\\}/g, CLOSE_BRACE);
  s = convertEnvironments(s);

  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      if (!m) {
        i++;
        continue;
      }
      const name = m[1];
      i += m[0].length;

      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const [num, a] = readArg(s, i);
        const [den, b] = readArg(s, a);
        i = b;
        out += `${wrap(convert(num))}/${wrap(convert(den))}`;
      } else if (name === 'sqrt') {
        let root = '';
        while (s[i] === ' ') i++;
        if (s[i] === '[') {
          const end = s.indexOf(']', i);
          if (end > i) {
            root = s.slice(i + 1, end);
            i = end + 1;
          }
        }
        const [arg, next] = readArg(s, i);
        i = next;
        const inner = convert(arg);
        const prefix = root === '3' ? '∛' : root === '4' ? '∜' : root ? `${convert(root)}√` : '√';
        out += `${prefix}${wrap(inner)}`;
      } else if (name === 'binom') {
        const [n, a] = readArg(s, i);
        const [k, b] = readArg(s, a);
        i = b;
        out += `C(${convert(n)}, ${convert(k)})`;
      } else if (name === 'mathbb') {
        const [arg, next] = readArg(s, i);
        i = next;
        out += BLACKBOARD[arg] ?? arg;
      } else if (name === 'vec' || name === 'overrightarrow') {
        const [arg, next] = readArg(s, i);
        i = next;
        out += `${convert(arg)}\u20D7`;
      } else if (name === 'hat') {
        const [arg, next] = readArg(s, i);
        i = next;
        out += `${convert(arg)}\u0302`;
      } else if (name === 'bar' || name === 'overline') {
        const [arg, next] = readArg(s, i);
        i = next;
        out += `${convert(arg)}\u0305`;
      } else if (
        ['text', 'textbf', 'textit', 'mathrm', 'mathbf', 'mathit', 'mathcal', 'boldsymbol', 'operatorname', 'mbox'].includes(name)
      ) {
        const [arg, next] = readArg(s, i);
        i = next;
        out += convert(arg);
      } else if (name === '\\') {
        out += '; ';
      } else if (name in SYMBOLS) {
        out += SYMBOLS[name];
      } else if (FUNCTIONS.has(name)) {
        out += name;
        // beri spasi supaya "det A" tidak menempel jadi "detA"
        if (/[A-Za-z(]/.test(s[i] ?? '') ) out += ' ';
      } else {
        // perintah tak dikenal: tampilkan namanya saja tanpa backslash
        out += name.length > 1 ? name : '';
      }
      continue;
    }

    if (ch === '^' || ch === '_') {
      const [arg, next] = readArg(s, i + 1);
      i = next;
      const inner = convert(arg);
      const table = ch === '^' ? SUPERSCRIPT : SUBSCRIPT;
      const mapped = mapAll(inner, table);
      if (mapped !== null) out += mapped;
      else out += `${ch}${isSimple(inner) ? inner : `(${inner})`}`;
      continue;
    }

    if (ch === '{' || ch === '}') {
      i++;
      continue;
    }
    if (ch === '~') {
      out += ' ';
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  return out.replace(/[ \t]+/g, ' ').replace(new RegExp(OPEN_BRACE, 'g'), '{').replace(new RegExp(CLOSE_BRACE, 'g'), '}').trim();
}

/**
 * Ubah teks soal/pilihan/pembahasan yang mungkin berisi LaTeX menjadi teks biasa.
 * - Segmen $$...$$, $...$, \(...\), \[...\] dikonversi.
 * - Teks di luar tanda dolar hanya dikonversi jika terlihat seperti LaTeX mentah (ada "\perintah").
 * - Penanda Markdown tebal (**) dibuang.
 */
export function latexToText(raw: string | null | undefined): string {
  if (!raw) return '';
  const text = String(raw).replace(/\*\*/g, '');

  const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
  let result = '';
  let last = 0;
  let m: RegExpExecArray | null;

  const plain = (chunk: string) => (/\\[a-zA-Z]/.test(chunk) ? convert(chunk) : chunk);

  while ((m = mathPattern.exec(text)) !== null) {
    result += plain(text.slice(last, m.index));
    result += convert(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
    last = m.index + m[0].length;
  }
  result += plain(text.slice(last));

  return result.replace(/[ \t]+\n/g, '\n').trim();
}
