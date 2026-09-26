import { useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { createCardImageUrl } from "../images/storage";
import { normalizeMath } from "./normalizeMath";

function PrivateImage({ src, alt }: { src?: string; alt?: string }) {
  const path = src?.startsWith("qm-image:")
    ? src.slice("qm-image:".length)
    : null;
  const [signedUrl, setSignedUrl] = useState<string | null>(
    path ? null : (src ?? null),
  );
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
        urlTransform={(url, key, node) =>
          node.tagName === "img" &&
          key === "src" &&
          /^qm-image:[a-zA-Z0-9/_-]+\.(png|jpg|webp|gif)$/.test(url)
            ? url
            : defaultUrlTransform(url)
        }
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
