import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { rapikanRumus } from '../lib/rumus';

// Render Markdown + rumus LaTeX ($...$ / $$...$$; \( \) dan \[ \] diubah dulu ke tanda dolar). HTML mentah sengaja tidak diaktifkan,
// sehingga konten hasil AI maupun suntingan guru tidak dapat menyisipkan skrip.
export default function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prosa ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        // Tabel lebar (mis. rencana per pertemuan) digulir ke samping di layar sempit, bukan merusak tata letak.
        components={{
          table: ({ node: _, ...p }) => (
            <div className="overflow-x-auto">
              <table {...p} />
            </div>
          ),
        }}
      >
        {rapikanRumus(children)}
      </ReactMarkdown>
    </div>
  );
}

// Versi sebaris untuk soal dan pilihan jawaban: tanpa pembungkus blok.
export function Inline({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{ p: ({ children: c }) => <span>{c}</span> }}
    >
      {rapikanRumus(children)}
    </ReactMarkdown>
  );
}
