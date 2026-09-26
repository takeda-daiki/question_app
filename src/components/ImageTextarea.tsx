import type { TextareaHTMLAttributes } from "react";

export type ImageSelection = { start: number; end: number };

export function insertImageMarkdown(
  current: string,
  markdown: string,
  selection: ImageSelection,
) {
  const before = current.slice(0, selection.start);
  const after = current.slice(selection.end);
  return `${before}${before && !before.endsWith("\n") ? "\n" : ""}${markdown}\n${after}`;
}

export function ImageTextarea({
  onImages,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  onImages: (files: File[], selection: ImageSelection) => void;
}) {
  return (
    <>
      <textarea
        {...props}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.items)
            .filter(
              (item) => item.kind === "file" && item.type.startsWith("image/"),
            )
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);
          if (!files.length) return; // Leave ordinary text paste to the browser.
          event.preventDefault();
          if (props.disabled || props.readOnly) return;
          onImages(files, {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          });
        }}
      />
      <small className="muted">
        画像をコピーし、この入力欄に貼り付け（Ctrl＋V／⌘V）できます。
      </small>
    </>
  );
}
