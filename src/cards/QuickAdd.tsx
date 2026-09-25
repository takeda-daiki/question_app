import { useEffect, useRef, useState } from "react";
import { addCard } from "./api";
import { ClassificationFields } from "./ClassificationFields";
import { InlineCreate } from "../components/InlineCreate";
import { Markdown } from "../components/Markdown";
import {
  cardImageMarkdown,
  deleteCardImages,
  uploadCardImage,
} from "../images/storage";
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
  const [selectedArea, setArea] = useState<string | null>(areaId);
  const [selectedField, setField] = useState<string | null>(fieldId);
  const [selectedTags, setTags] = useState<string[]>([]);
  const [createdTags, setCreatedTags] = useState<Tag[]>([]);
  const [status, setStatus] = useState<"unresolved" | "resolved">("unresolved");
  const [importance, setImportance] = useState<number | null>(null);
  const [effort, setEffort] = useState<"low" | "medium" | "high" | null>(null);
  const [body, setBody] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [creating, setCreating] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [cardCreated, setCardCreated] = useState(false);
  const savedId = useRef<string | null>(null);

  const tags = [
    ...new Map([...data.tags, ...createdTags].map((tag) => [tag.id, tag])).values(),
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

  async function requestClose() {
    const hasInput =
      Boolean(title.trim()) ||
      (detailed &&
        (Boolean(body.trim()) ||
          Boolean(conclusion.trim()) ||
          status !== "unresolved" ||
          importance !== null ||
          effort !== null ||
          selectedTags.length > 0));

    if (
      busy ||
      creating ||
      imageBusy ||
      (hasInput && !window.confirm("入力中の内容を破棄して閉じますか？"))
    ) {
      return;
    }

    if (!cardCreated && uploadedImages.length) {
      try {
        await deleteCardImages(uploadedImages);
      } catch {
        // 保存前に閉じる場合の画像掃除失敗だけで画面を閉じられなくしない。
      }
    }
    close();
  }

  async function addImage(target: "body" | "conclusion", file: File) {
    if (!detailed || cardCreated) return;

    setImageBusy(true);
    setError("");
    try {
      const id = attempt.current?.id ?? crypto.randomUUID();
      if (!attempt.current) attempt.current = { id, title: title.trim() };

      const path = await uploadCardImage(userId, id, file);
      setUploadedImages((prev) => [...prev, path]);

      const markdown = cardImageMarkdown(path, file.name);
      const append = (current: string) =>
        `${current}${current && !current.endsWith("\n") ? "\n" : ""}${markdown}\n`;

      if (target === "body") setBody(append);
      else setConclusion(append);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "画像のアップロードに失敗しました。",
      );
    } finally {
      setImageBusy(false);
    }
  }

  const classification = (
    <>
      <div className="form-grid">
        <ClassificationFields
          data={data}
          userId={userId}
          areaId={selectedArea}
          fieldId={selectedField}
          change={(nextArea: string | null, nextField: string | null) => {
            setArea(nextArea);
            setField(nextField);
          }}
          disabled={busy || creating || imageBusy || cardCreated}
          onBusyChange={setCreating}
          refresh={refresh}
        />
      </div>

      <h3>タグ</h3>
      <div className="chips">
        {tags.map((tag: Tag) => (
          <label className="tag-choice" key={tag.id}>
            <input
              type="checkbox"
              disabled={busy || creating || imageBusy || cardCreated}
              checked={selectedTags.includes(tag.id)}
              onChange={(event) =>
                setTags((prev) =>
                  event.target.checked
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
        disabled={busy || creating || imageBusy || cardCreated}
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
      onCancel={(event) => {
        event.preventDefault();
        void requestClose();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current || creating || imageBusy || !title.trim()) return;

          lock.current = true;
          setBusy(true);
          setError("");
          const clean = title.trim();

          if (!attempt.current) {
            attempt.current = { id: crypto.randomUUID(), title: clean };
          } else {
            attempt.current.title = clean;
          }

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
                    ? { status, importance, effort, body, conclusion }
                    : undefined,
                );

            savedId.current = card.id;
            setCardCreated(true);

            for (const tagId of selectedTags) {
              await setTag(userId, card.id, tagId, true);
            }

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
        <h2>
          {detailed ? "詳細を設定して疑問を追加" : "いま、気になっていることは？"}
        </h2>
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
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy || creating || imageBusy || cardCreated}
          required
          placeholder="例：ベイズ推定とは？"
        />

        {detailed ? (
          <div className="detailed-add-fields">
            {classification}

            <div className="form-grid">
              <label>
                状態
                <select
                  value={status}
                  disabled={busy || creating || imageBusy || cardCreated}
                  onChange={(event) =>
                    setStatus(event.target.value as "unresolved" | "resolved")
                  }
                >
                  <option value="unresolved">疑問</option>
                  <option value="resolved">解決済み</option>
                </select>
              </label>

              <label>
                重要度
                <select
                  value={importance ?? ""}
                  disabled={busy || creating || imageBusy || cardCreated}
                  onChange={(event) =>
                    setImportance(
                      event.target.value ? Number(event.target.value) : null,
                    )
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
                  disabled={busy || creating || imageBusy || cardCreated}
                  onChange={(event) =>
                    setEffort(
                      (event.target.value || null) as
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

            <section>
              <label htmlFor="detailed-body">本文（問題側）</label>
              <div className="editor-grid">
                <div>
                  <textarea
                    id="detailed-body"
                    rows={8}
                    value={body}
                    disabled={busy || creating || imageBusy || cardCreated}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={"Markdown、$数式$、$$別行数式$$、\\begin{align}...\\end{align} が使えます"}
                  />
                  <div className="image-upload-row">
                    <label className="image-upload-button">
                      写真を追加
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={busy || creating || imageBusy || cardCreated}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void addImage("body", file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {imageBusy && <span className="muted">画像を送信中…</span>}
                  </div>
                </div>
                <div className="preview">
                  <small>プレビュー</small>
                  <Markdown text={body} />
                </div>
              </div>
            </section>

            <section>
              <label htmlFor="detailed-conclusion">結論（解答側）</label>
              <div className="editor-grid">
                <div>
                  <textarea
                    id="detailed-conclusion"
                    rows={8}
                    value={conclusion}
                    disabled={busy || creating || imageBusy || cardCreated}
                    onChange={(event) => setConclusion(event.target.value)}
                    placeholder={"Markdown、$数式$、$$別行数式$$、\\begin{align}...\\end{align} が使えます"}
                  />
                  <div className="image-upload-row">
                    <label className="image-upload-button">
                      写真を追加
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={busy || creating || imageBusy || cardCreated}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void addImage("conclusion", file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {imageBusy && <span className="muted">画像を送信中…</span>}
                  </div>
                </div>
                <div className="preview">
                  <small>プレビュー</small>
                  <Markdown text={conclusion} />
                </div>
              </div>
            </section>
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
                onChange={(event) => setOpenAfterSave(event.target.checked)}
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
            disabled={busy || creating || imageBusy}
            onClick={() => void requestClose()}
          >
            閉じる
          </button>
          <button
            className="primary"
            disabled={busy || creating || imageBusy || !title.trim()}
          >
            {busy ? "保存中…" : "保存する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
