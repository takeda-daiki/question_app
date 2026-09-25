import { useEffect, useRef, useState } from "react";
import { addCard } from "./api";

export function QuickAdd({
  userId,
  areaId,
  fieldId,
  saved,
  close,
}: {
  userId: string;
  areaId: string | null;
  fieldId: string | null;
  saved: (id: string, details: boolean) => Promise<void>;
  close: () => void;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const attempt = useRef<{ id: string; title: string } | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (title.trim()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [title]);
  function requestClose() {
    if (
      !busy &&
      (!title.trim() ||
        window.confirm("入力中のタイトルを破棄して閉じますか？"))
    )
      close();
  }
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current || !title.trim()) return;
          lock.current = true;
          setBusy(true);
          setError("");
          const clean = title.trim();
          if (!attempt.current || attempt.current.title !== clean)
            attempt.current = { id: crypto.randomUUID(), title: clean };
          try {
            const card = await addCard(
              userId,
              attempt.current.id,
              clean,
              areaId,
              fieldId,
            );
            await saved(card.id, details);
          } catch {
            setError(
              "保存を確認できませんでした。入力は残っています。通信状態を確認して再試行してください。",
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">A NEW QUESTION</span>
        <h2>いま、気になっていることは？</h2>
        <p className="muted">まずはタイトルだけ。短い言葉で大丈夫。</p>
        <label htmlFor="card-title">疑問のタイトル</label>
        <input
          autoFocus
          id="card-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          required
          placeholder="例：ベイズ推定とは？"
        />
        <label className="tag-choice">
          <input
            type="checkbox"
            checked={details}
            onChange={(e) => setDetails(e.target.checked)}
          />
          保存後に詳細を追加
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={requestClose}
          >
            閉じる
          </button>
          <button className="primary" disabled={busy || !title.trim()}>
            {busy ? "保存中…" : "保存する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
