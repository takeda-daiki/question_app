import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { createCardImageUrl } from "../images/storage";

function normalizeMath(text: string) {
  let value = text;

  // Obsidian等でよく使う \[...\] を remark-math の display math に寄せる。
  value = value.replace(/\\\[([\s\S]*?)\\\]/g, (_match, body: string) => {
    return `\n$$\n${body.trim()}\n$$\n`;
  });

  // align / align* を単独で書いても表示数式として扱えるようにする。
  value = value.replace(
    /(^|\n)(\\begin\{align\*?\}[\s\S]*?\\end\{align\*?\})(?=\n|$)/g,
    (_match, prefix: string, block: string) =>
      `${prefix}$$\n${block}\n$$`,
  );

  return value;
}

function PrivateImage({ src, alt }: { src?: string; alt?: string }) {
  const path = src?.startsWith("qm-image:") ? src.slice("qm-image:".length) : null;
  const [signedUrl, setSignedUrl] = useState<string | null>(path ? null : src ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!path) {
      setSignedUrl(src ?? null);
      setFailed(false);
      return () => {
        active = false;
      };
    }

    setSignedUrl(null);
    setFailed(false);
    void createCardImageUrl(path)
      .then((url: string) => {
        if (active) setSignedUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [path, src]);

  if (failed) return <span>[画像を表示できません: {alt ?? "画像"}]</span>;
  if (!signedUrl) return <span>画像を読み込み中…</span>;

  return (
    <img
      src={signedUrl}
      alt={alt ?? ""}
      loading="lazy"
      className="markdown-image"
    />
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { trust: false, strict: "ignore" }]]}
        skipHtml
        components={{
          img: ({ alt, src }) => <PrivateImage alt={alt} src={src} />,
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
