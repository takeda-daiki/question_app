import { useEffect, useRef, useState } from "react";
import type { Card, Notebook } from "../data/types";
import {
  addLink,
  ensureNamed,
  failure,
  removeLink,
  setTag,
  updateCard,
  type CardChanges,
} from "../data/repository";
import { Markdown } from "../components/Markdown";
import { ClassificationFields } from "./ClassificationFields";
import { InlineCreate } from "../components/InlineCreate";

export function CardDetail({
  card,
  data,
  userId,
  refresh,
  close,
  navigate,
}: {
  card: Card;
  data: Notebook;
  userId: string;
  refresh: () => Promise<void>;
  close: () => void;
  navigate: (id: string) => void;
}) {
  const [original, setOriginal] = useState(card);
  const [draft, setDraft] = useState<CardChanges>({
    title: card.title,
    body: card.body ?? "",
    conclusion: card.conclusion ?? "",
    area_id: card.area_id ?? null,
    field_id: card.field_id ?? null,
    importance: card.importance ?? null,
    effort: card.effort ?? null,
    status: card.status ?? "unresolved",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setBusy] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const busy = saving || classifying;
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [related, setRelated] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function patch(values: Partial<CardChanges>) {
    setDraft({ ...draft, ...values });
    setDirty(true);
    setNotice("");
  }
  function mayLeave() {
    return (
      !busy &&
      (!dirty || window.confirm("未保存の変更を破棄して移動しますか？"))
    );
  }
  async function run(operation: () => Promise<unknown>, message: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice(message);
      await refresh();
    } catch (e) {
      setError(failure(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const links = data.links.filter(
    (l) => l.card_a_id === card.id || l.card_b_id === card.id,
  );
  const linkedIds = links.map((l) =>
    l.card_a_id === card.id ? l.card_b_id : l.card_a_id,
  );
  return (
    <dialog
      className="detail-dialog"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (mayLeave()) close();
      }}
    >
      <div className="detail-top">
        <span className="eyebrow">QUESTION DETAILS</span>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            if (mayLeave()) close();
          }}
        >
          閉じる
        </button>
      </div>
      <h2>疑問の詳細</h2>
      {card.deleted_at && (
        <p className="notice">
          ゴミ箱のカードです。編集するには先に復元してください。
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const saved = await updateCard(userId, original, {
              ...draft,
              title: draft.title.trim(),
            });
            setOriginal(saved);
            setDirty(false);
          }, "保存しました。");
        }}
      >
        <fieldset disabled={busy || Boolean(card.deleted_at)}>
          <label htmlFor="detail-title">タイトル</label>
          <input
            id="detail-title"
            required
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
          <div className="form-grid">
            <label>
              状態
              <select
                value={draft.status}
                onChange={(e) =>
                  patch({ status: e.target.value as Card["status"] })
                }
              >
                <option value="unresolved">疑問</option>
                <option value="resolved">解決済み</option>
              </select>
            </label>
            <label>
              重要度
              <select
                value={draft.importance ?? ""}
                onChange={(e) =>
                  patch({
                    importance: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">未整理</option>
                {[3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              労力
              <select
                value={draft.effort ?? ""}
                onChange={(e) =>
                  patch({ effort: (e.target.value || null) as Card["effort"] })
                }
              >
                <option value="">未設定</option>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </label>
            <ClassificationFields
              data={data}
              userId={userId}
              areaId={draft.area_id}
              fieldId={draft.field_id}
              change={(area_id, field_id) => patch({ area_id, field_id })}
              disabled={busy || Boolean(card.deleted_at)}
              onBusyChange={setClassifying}
              refresh={refresh}
            />
          </div>
          {(["body", "conclusion"] as const).map((key) => (
            <section key={key}>
              <label htmlFor={key}>{key === "body" ? "本文" : "結論"}</label>
              <div className="editor-grid">
                <textarea
                  id={key}
                  rows={7}
                  value={draft[key] ?? ""}
                  placeholder="Markdownと $数式$ が使えます"
                  onChange={(e) => patch({ [key]: e.target.value })}
                />
                <div className="preview">
                  <small>プレビュー</small>
                  <Markdown text={draft[key] ?? ""} />
                </div>
              </div>
            </section>
          ))}
          <div className="dialog-actions">
            <span className="muted">
              {dirty ? "未保存の変更があります" : "保存済み"}
            </span>
            <button className="primary" disabled={!draft.title.trim()}>
              {busy ? "保存中…" : "変更を保存"}
            </button>
          </div>
        </fieldset>
      </form>
      <p role="status" className="notice">
        {notice}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="relations">
        <h3>タグ</h3>
        <small className="muted">
          タグと関連カードの変更は、その都度保存されます。
        </small>
        <div className="chips">
          {data.tags.map((tag) => (
            <label className="tag-choice" key={tag.id}>
              <input
                type="checkbox"
                disabled={busy || Boolean(card.deleted_at)}
                checked={data.cardTags.some(
                  (t) => t.card_id === card.id && t.tag_id === tag.id,
                )}
                onChange={(e) =>
                  void run(
                    () => setTag(userId, card.id, tag.id, e.target.checked),
                    "タグを保存しました。",
                  )
                }
              />
              {tag.name}
            </label>
          ))}
        </div>
        <InlineCreate
          label="タグ"
          disabled={busy || Boolean(card.deleted_at)}
          onBusyChange={setClassifying}
          create={async (name) => {
            const tag = await ensureNamed(userId, "tags", name);
            await setTag(userId, card.id, tag.id, true);
            await refresh();
            setNotice("タグを作成して設定しました。");
          }}
        />
        <h3>関連カード</h3>
        {links.map((link) => {
          const other = data.cards.find(
            (c) =>
              c.id ===
              (link.card_a_id === card.id ? link.card_b_id : link.card_a_id),
          );
          return (
            <div className="related-row" key={link.id}>
              <button
                className="text-button"
                disabled={!other || !!other.deleted_at || busy}
                onClick={() => {
                  if (mayLeave()) navigate(other!.id);
                }}
              >
                {other?.deleted_at ? "ゴミ箱：" : ""}
                {other?.title ?? "カードが見つかりません"}
              </button>
              <button
                className="text-button"
                disabled={busy || !!card.deleted_at}
                onClick={() =>
                  void run(
                    () => removeLink(userId, link.id),
                    "関連付けを解除しました。",
                  )
                }
              >
                解除
              </button>
            </div>
          );
        })}
        <div className="inline-form">
          <select
            aria-label="関連付けるカード"
            value={related}
            onChange={(e) => setRelated(e.target.value)}
            disabled={busy || !!card.deleted_at}
          >
            <option value="">カードを選択</option>
            {data.cards
              .filter(
                (c) =>
                  c.id !== card.id &&
                  !c.deleted_at &&
                  !linkedIds.includes(c.id),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
          <button
            className="secondary"
            disabled={!related || busy || !!card.deleted_at}
            onClick={() =>
              void run(async () => {
                await addLink(userId, card.id, related);
                setRelated("");
              }, "関連付けました。")
            }
          >
            関連付ける
          </button>
        </div>
      </section>
      <p className="muted">
        作成：{new Date(card.created_at).toLocaleString("ja-JP")}
        <br />
        更新：
        {new Date(original.updated_at || card.created_at).toLocaleString(
          "ja-JP",
        )}
        {original.resolved_at && (
          <>
            <br />
            解決：{new Date(original.resolved_at).toLocaleString("ja-JP")}
          </>
        )}
      </p>
    </dialog>
  );
}
