import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  children: string;
  className?: string;
}

// Merender teks yang mungkin berisi notasi matematika LaTeX (dibungkus $...$ atau $$...$$)
// beserta format Markdown dasar (tebal, miring). Dipakai untuk soal, pilihan jawaban,
// dan pembahasan yang biasanya berupa satu baris teks pendek.
export default function MathText({ children, className }: MathTextProps) {
  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Cegah <p> bersarang di dalam elemen inline (mis. <li>, <span>) pemanggil.
          p: ({ children: inner }) => <>{inner}</>,
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}
