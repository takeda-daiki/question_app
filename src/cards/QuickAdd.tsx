import { useEffect, useRef, useState } from "react";
import { addCard } from "./api";
import { ClassificationFields } from "./ClassificationFields";
import { InlineCreate } from "../components/InlineCreate";
import { ensureNamed, setTag } from "../data/repository";
import type { Notebook, Tag } from "../data/types";

export function QuickAdd({
  userId,
  data,
  refresh,
  areaId,
  fieldId,
  saved,
  close,
}: {
  userId: string;
  data: Notebook;
  refresh: () => Promise<void>;
  areaId: string | null;
  fieldId: string | null;
  saved: (id: string, details: boolean) => Promise<void>;
  close: () => void;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedArea, setArea] = useState(areaId);
  const [selectedField, setField] = useState(fieldId);
  const [selectedTags, setTags] = useState<string[]>([]);
  const [createdTags, setCreatedTags] = useState<Tag[]>([]);
  const [creating, setCreating] = useState(false);
  const [cardCreated, setCardCreated] = useState(false);
  const savedId = useRef<string | null>(null);
  const tags = [
    ...new Map([...data.tags, ...createdTags].map((t) => [t.id, t])).values(),
  ];
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
      !creating &&
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
          if (lock.current || creating || !title.trim()) return;
          lock.current = true;
          setBusy(true);
          setError("");
          const clean = title.trim();
          if (!attempt.current || attempt.current.title !== clean)
            attempt.current = { id: crypto.randomUUID(), title: clean };
          try {
            const card = savedId.current
              ? { id: savedId.current }
              : await addCard(
                  userId,
                  attempt.current.id,
                  clean,
                  selectedArea,
                  selectedField,
                );
            savedId.current = card.id;
            setCardCreated(true);
            for (const tagId of selectedTags)
              await setTag(userId, card.id, tagId, true);
            await saved(card.id, details);
          } catch {
            setError(
              savedId.current
                ? "疑問は保存済みですが、タグの保存または一覧の更新に失敗しました。同じ疑問に対して再試行できます。"
                : "保存を確認できませんでした。入力は残っています。通信状態を確認して再試行してください。",
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
          disabled={busy || creating || cardCreated}
          required
          placeholder="例：ベイズ推定とは？"
        />
        <details
          className="quick-classification"
          open={Boolean(areaId || fieldId) || undefined}
        >
          <summary>領域・分野・タグを追加（任意）</summary>
          <p className="muted">
            新規作成した項目はその場で保存されます。疑問への設定は「保存する」で確定します。
          </p>
          <div className="form-grid">
            <ClassificationFields
              data={data}
              userId={userId}
              areaId={selectedArea}
              fieldId={selectedField}
              change={(a, f) => {
                setArea(a);
                setField(f);
              }}
              disabled={busy || creating || cardCreated}
              onBusyChange={setCreating}
              refresh={refresh}
            />
          </div>
          <h3>タグ</h3>
          <div className="chips">
            {tags.map((tag) => (
              <label className="tag-choice" key={tag.id}>
                <input
                  type="checkbox"
                  disabled={busy || creating || cardCreated}
                  checked={selectedTags.includes(tag.id)}
                  onChange={(e) =>
                    setTags((prev) =>
                      e.target.checked
                        ? [...prev, tag.id]
                        : prev.filter((id) => id !== tag.id),
                    )
                  }
                />
                {tag.name}
              </label>
            ))}
          </div>
          <InlineCreate
            label="タグ"
            disabled={busy || creating || cardCreated}
            onBusyChange={setCreating}
            create={async (name) => {
              const tag = (await ensureNamed(userId, "tags", name)) as Tag;
              setCreatedTags((prev) => [...prev, tag]);
              setTags((prev) => [...new Set([...prev, tag.id])]);
              await refresh();
            }}
          />
        </details>
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
            disabled={busy || creating}
            onClick={requestClose}
          >
            閉じる
          </button>
          <button
            className="primary"
            disabled={busy || creating || !title.trim()}
          >
            {busy ? "保存中…" : "保存する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
