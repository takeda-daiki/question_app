import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { createCardImageUrl } from "../images/storage";

const IMAGE_PREFIX = "/qm-image/";

function normalizeMath(source: string) {
  let text = source;

  // Obsidian/LaTeX-style display delimiters.
  text = text.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_match, body: string) => `\n$$\n${body.trim()}\n$$\n`,
  );

  // Allow a raw align/align* block without requiring the user to wrap it in $$.
  text = text.replace(
    /(^|\n)\s*\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}\s*(?=\n|$)/g,
    (_match, lead: string, body: string) =>
      `${lead}\n$$\n\\begin{aligned}${body}\\end{aligned}\n$$\n`,
  );

  // KaTeX expects aligned inside math mode rather than a nested align environment.
  text = text
    .replace(/\\begin\{align\*?\}/g, "\\begin{aligned}")
    .replace(/\\end\{align\*?\}/g, "\\end{aligned}");

  // remark-math is most reliable when display-math fences occupy their own lines.
  text = text.replace(
    /\$\$([^\n$][^\n]*?)\$\$/g,
    (_match, body: string) => `\n$$\n${body.trim()}\n$$\n`,
  );

  return text;
}

function PrivateCardImage({ src, alt }: { src: string; alt?: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const path = src.slice(IMAGE_PREFIX.length);
    setUrl("");
    setFailed(false);
    void createCardImageUrl(path)
      .then((signed) => {
        if (alive) setUrl(signed);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [src]);

  if (failed) return <span className="muted">[画像を読み込めませんでした]</span>;
  if (!url) return <span className="muted">画像を読み込み中…</span>;
  return <img className="markdown-image" src={url} alt={alt ?? "添付画像"} />;
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
        rehypePlugins={[[rehypeKatex, { trust: false, strict: "ignore" }]]}
        skipHtml
        components={{
          img: ({ alt, src }) =>
            typeof src === "string" && src.startsWith(IMAGE_PREFIX) ? (
              <PrivateCardImage src={src} alt={alt ?? undefined} />
            ) : (
              <span>[画像: {alt ?? "画像"}]</span>
            ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {normalizeMath(text || "まだ記入されていません。")}
      </ReactMarkdown>
    </div>
  );
}
