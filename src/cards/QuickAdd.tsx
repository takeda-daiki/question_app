import { useEffect, useRef, useState } from "react";
import { addCard } from "./api";
import { ClassificationFields } from "./ClassificationFields";
import { InlineCreate } from "../components/InlineCreate";
import { ensureNamed, setTag } from "../data/repository";
import type { Notebook, Tag } from "../data/types";

type AddMode = "quick" | "detailed";

export function QuickAdd({
  userId,
  data,
  refresh,
  areaId,
  fieldId,
  saved,
  close,
  mode = "quick",
}: {
  userId: string;
  data: Notebook;
  refresh: () => Promise<void>;
  areaId: string | null;
  fieldId: string | null;
  saved: (id: string, details: boolean) => Promise<void>;
  close: () => void;
  mode?: AddMode;
}) {
  const detailed = mode === "detailed";
  const [title, setTitle] = useState("");
  const [openAfterSave, setOpenAfterSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedArea, setArea] = useState(areaId);
  const [selectedField, setField] = useState(fieldId);
  const [selectedTags, setTags] = useState<string[]>([]);
  const [createdTags, setCreatedTags] = useState<Tag[]>([]);
  const [importance, setImportance] = useState<number | null>(null);
  const [effort, setEffort] = useState<"low" | "medium" | "high" | null>(null);
  const [body, setBody] = useState("");
  const [conclusion, setConclusion] = useState("");
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
      if (title.trim() || (detailed && (body.trim() || conclusion.trim()))) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [title, body, conclusion, detailed]);

  function requestClose() {
    const hasInput =
      title.trim() ||
      (detailed &&
        (body.trim() ||
          conclusion.trim() ||
          importance !== null ||
          effort !== null ||
          selectedTags.length > 0));
    if (
      !busy &&
      !creating &&
      (!hasInput || window.confirm("入力中の内容を破棄して閉じますか？"))
    )
      close();
  }

  const classification = (
    <>
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
    </>
  );

  return (
    <dialog
      ref={dialog}
      className={detailed ? "detail-dialog add-detail-dialog" : undefined}
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
                  detailed
                    ? { importance, effort, body, conclusion }
                    : undefined,
                );
            savedId.current = card.id;
            setCardCreated(true);
            for (const tagId of selectedTags)
              await setTag(userId, card.id, tagId, true);
            await saved(card.id, detailed ? false : openAfterSave);
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
        <h2>{detailed ? "詳細を設定して疑問を追加" : "いま、気になっていることは？"}</h2>
        <p className="muted">
          {detailed
            ? "整理に必要な情報をここで設定してから保存できます。タイトル以外は任意です。"
            : "まずはタイトルだけ。短い言葉で大丈夫。"}
        </p>
        <label htmlFor={detailed ? "detailed-card-title" : "card-title"}>
          疑問のタイトル
        </label>
        <input
          autoFocus
          id={detailed ? "detailed-card-title" : "card-title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy || creating || cardCreated}
          required
          placeholder="例：ベイズ推定とは？"
        />

        {detailed ? (
          <div className="detailed-add-fields">
            {classification}
            <div className="form-grid">
              <label>
                重要度
                <select
                  value={importance ?? ""}
                  disabled={busy || creating || cardCreated}
                  onChange={(e) =>
                    setImportance(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">未設定</option>
                  <option value="3">★★★</option>
                  <option value="2">★★</option>
                  <option value="1">★</option>
                </select>
              </label>
              <label>
                労力
                <select
                  value={effort ?? ""}
                  disabled={busy || creating || cardCreated}
                  onChange={(e) =>
                    setEffort(
                      (e.target.value || null) as
                        | "low"
                        | "medium"
                        | "high"
                        | null,
                    )
                  }
                >
                  <option value="">未設定</option>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </label>
            </div>
            <label>
              本文
              <textarea
                rows={7}
                value={body}
                disabled={busy || creating || cardCreated}
                onChange={(e) => setBody(e.target.value)}
                placeholder="調べたいこと、背景、メモなど"
              />
            </label>
            <label>
              結論
              <textarea
                rows={5}
                value={conclusion}
                disabled={busy || creating || cardCreated}
                onChange={(e) => setConclusion(e.target.value)}
                placeholder="分かっている結論があれば入力"
              />
            </label>
          </div>
        ) : (
          <>
            <details
              className="quick-classification"
              open={Boolean(areaId || fieldId) || undefined}
            >
              <summary>領域・分野・タグを追加（任意）</summary>
              <p className="muted">
                新規作成した項目はその場で保存されます。疑問への設定は「保存する」で確定します。
              </p>
              {classification}
            </details>
            <label className="tag-choice">
              <input
                type="checkbox"
                checked={openAfterSave}
                onChange={(e) => setOpenAfterSave(e.target.checked)}
              />
              保存後に詳細を追加
            </label>
          </>
        )}

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
