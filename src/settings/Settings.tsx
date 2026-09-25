import { useState } from "react";
import type { Notebook } from "../data/types";
import {
  createNamed,
  deleteNamed,
  editNamed,
  failure,
  loadNotebook,
} from "../data/repository";

export function Settings({
  data,
  userId,
  refresh,
}: {
  data: Notebook;
  userId: string;
  refresh: () => Promise<void>;
}) {
  const [kind, setKind] = useState<"areas" | "fields" | "tags">("areas");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [color, setColor] = useState("#256653");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const labels = { areas: "領域", fields: "分野", tags: "タグ" };
  const rows =
    kind === "fields"
      ? data.fields.filter((f) => f.area_id === area)
      : data[kind];
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage("保存しました。");
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    setBusy(true);
    setError("");
    try {
      const snapshot = await loadNotebook(userId);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              format: "question-notebook",
              version: 1,
              exportedAt: new Date().toISOString(),
              ...snapshot,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `question-notebook-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("バックアップをダウンロードしました。");
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>整理の設定</h2>
      <div className="tabs">
        {(["areas", "fields", "tags"] as const).map((k) => (
          <button
            key={k}
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setEditing(null);
              setName("");
            }}
          >
            {labels[k]}
          </button>
        ))}
      </div>
      <form
        className="panel settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const extra =
              kind === "areas"
                ? { color }
                : kind === "fields"
                  ? { area_id: area }
                  : {};
            if (editing)
              await editNamed(userId, kind, editing, {
                name: name.trim(),
                ...extra,
              });
            else
              await createNamed(userId, kind, name, {
                ...extra,
                ...(kind !== "tags"
                  ? {
                      sort_order:
                        Math.max(
                          -1,
                          ...rows.map((r) =>
                            "sort_order" in r ? Number(r.sort_order) : 0,
                          ),
                        ) + 1,
                    }
                  : {}),
              });
            setName("");
            setEditing(null);
          });
        }}
      >
        {kind === "fields" && (
          <label>
            親の領域
            <select
              value={area}
              required
              onChange={(e) => {
                setArea(e.target.value);
                setEditing(null);
                setName("");
              }}
            >
              <option value="">選択してください</option>
              {data.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {labels[kind]}名
          <input
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {kind === "areas" && (
          <label>
            領域の色
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        )}
        <div className="dialog-actions">
          {editing && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditing(null);
                setName("");
              }}
            >
              編集をやめる
            </button>
          )}
          <button
            className="primary"
            disabled={busy || !name.trim() || (kind === "fields" && !area)}
          >
            {editing ? "名前・色を保存" : `${labels[kind]}を作成`}
          </button>
        </div>
      </form>
      <ul className="settings-list">
        {rows.map((row, index) => (
          <li key={row.id}>
            <span>{row.name}</span>
            <div className="row-actions">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setEditing(row.id);
                  setName(row.name);
                  if ("color" in row)
                    setColor(
                      typeof row.color === "string" ? row.color : "#256653",
                    );
                }}
              >
                編集
              </button>
              {kind !== "tags" && (
                <>
                  {([-1, 1] as const).map((delta) => (
                    <button
                      key={delta}
                      className="text-button"
                      aria-label={`${row.name}を${delta < 0 ? "上" : "下"}へ`}
                      disabled={
                        busy ||
                        index + delta < 0 ||
                        index + delta >= rows.length
                      }
                      onClick={() =>
                        void run(async () => {
                          const reordered = [...rows];
                          [reordered[index], reordered[index + delta]] = [
                            reordered[index + delta],
                            reordered[index],
                          ];
                          for (let i = 0; i < reordered.length; i++)
                            await editNamed(userId, kind, reordered[i].id, {
                              sort_order: i,
                            });
                        })
                      }
                    >
                      {delta < 0 ? "↑" : "↓"}
                    </button>
                  ))}
                </>
              )}
              <button
                className="danger-text"
                disabled={busy}
                onClick={() => {
                  const inUse =
                    kind === "areas"
                      ? data.cards.some((c) => c.area_id === row.id) ||
                        data.fields.some((f) => f.area_id === row.id)
                      : kind === "fields"
                        ? data.cards.some((c) => c.field_id === row.id)
                        : false;
                  if (inUse) {
                    setError(
                      "使用中の分類です。カード（ゴミ箱内も含む）や分野の分類を変更してから削除してください。",
                    );
                    return;
                  }
                  if (
                    window.confirm(
                      `「${row.name}」を削除しますか？${kind === "tags" ? "カードとのタグ付けも解除されます。" : ""}`,
                    )
                  )
                    void run(() => deleteNamed(userId, kind, row.id));
                }}
              >
                削除
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p role="status">{message}</p>
      <section className="panel settings-form">
        <h2>バックアップ</h2>
        <p className="muted">
          カード、ゴミ箱、分類、タグ、関連情報をJSONで保存します。アカウントのパスワードは含みません。
        </p>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void exportData()}
        >
          JSONをエクスポート
        </button>
      </section>
      <section className="panel settings-form">
        <h2>スマートフォンで使う</h2>
        <p>
          公開ページをブラウザーで開き、メニューの「ホーム画面に追加」を選んでください。
        </p>
        <p className="muted">
          データの読み込み・保存にはインターネット接続が必要です。
        </p>
      </section>
    </section>
  );
}
