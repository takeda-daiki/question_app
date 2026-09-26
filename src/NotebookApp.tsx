import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { emptyNotebook, type Card, type Notebook } from "./data/types";
import {
  failure,
  loadNotebook,
  permanentlyDelete,
  updateCard,
} from "./data/repository";
import { filterCards, initialFilters, type Filters } from "./cards/filter";
import { QuickAdd } from "./cards/QuickAdd";
import { Settings } from "./settings/Settings";
const Graph = lazy(() =>
  import("./graph/Graph").then((m) => ({ default: m.Graph })),
);
const CardDetail = lazy(() =>
  import("./cards/CardDetail").then((m) => ({ default: m.CardDetail })),
);
type View = "cards" | "search" | "graph" | "settings" | "trash";
export function NotebookApp({ userId }: { userId: string }) {
  const [data, setData] = useState<Notebook>(emptyNotebook);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [view, setView] = useState<View>("cards");
  const [quick, setQuick] = useState(false);
  const [detailedAdd, setDetailedAdd] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [limit, setLimit] = useState(50);
  const active = useRef(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const next = await loadNotebook(userId);
      if (active.current && version === generation.current) setData(next);
    } catch (e) {
      if (active.current && version === generation.current)
        setError(
          "一覧を読み込めませんでした。通信状態と接続設定を確認してください。",
        );
      throw e;
    } finally {
      if (active.current && version === generation.current) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    active.current = true;
    void refresh().catch(() => {});
    return () => {
      active.current = false;
      generation.current++;
    };
  }, [refresh]);
  function navigate(next: View) {
    setView(next);
    setFilters({
      ...initialFilters,
      status:
        next === "trash" || next === "search" || next === "graph"
          ? "all"
          : "unresolved",
    });
    setLimit(50);
  }
  function patch(values: Partial<Filters>) {
    setFilters({ ...filters, ...values });
    setLimit(50);
  }
  function showCardsForArea(area: string) {
    setView("cards");
    setFilters({
      ...initialFilters,
      status: "unresolved",
      area,
      field: "",
    });
    setLimit(50);
  }
  const visible = useMemo(
    () => filterCards(data, filters, view === "trash"),
    [data, filters, view],
  );
  const card = data.cards.find((c) => c.id === selected);
  async function mutate(
    c: Card,
    operation: "trash" | "restore" | "delete" | "resolve" | "reopen",
  ) {
    if (busy || mutationLock.current) return;
    if (c.deleted_at && (operation === "resolve" || operation === "reopen"))
      return;
    if (
      operation === "delete" &&
      !window.confirm(
        `「${c.title}」を完全に削除しますか？この操作は取り消せません。`,
      )
    )
      return;
    if (
      operation === "trash" &&
      !window.confirm(
        `「${c.title}」をゴミ箱へ移動しますか？後から復元できます。`,
      )
    )
      return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (operation === "delete") await permanentlyDelete(userId, c);
      else if (operation === "resolve" || operation === "reopen") {
        const updated = await updateCard(userId, c, {
          status: operation === "resolve" ? "resolved" : "unresolved",
        });
        setData((current) => ({
          ...current,
          cards: current.cards.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        }));
      } else
        await updateCard(userId, c, {
          deleted_at: operation === "trash" ? new Date().toISOString() : null,
        });
      setNotice(
        operation === "resolve"
          ? "解決済みにしました。"
          : operation === "reopen"
            ? "疑問に戻しました。"
            : operation === "restore"
              ? "復元しました。"
              : operation === "trash"
                ? "ゴミ箱へ移動しました。"
                : "完全に削除しました。",
      );
      await refresh();
    } catch (e) {
      setError(failure(e));
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  const titles = {
    cards: "疑問一覧",
    search: "検索",
    graph: "関連グラフ",
    settings: "設定",
    trash: "ゴミ箱",
  };
  return (
    <main className="workspace notebook">
      <aside className="sidebar">
        <span className="eyebrow">MY NOTEBOOK</span>
        <nav>
          {(["cards", "search", "graph", "settings", "trash"] as const).map(
            (v) => (
              <button
                className={view === v ? "selected" : "text-button"}
                key={v}
                onClick={() => navigate(v)}
              >
                {titles[v]}
              </button>
            ),
          )}
        </nav>
        <h3>領域</h3>
        <button className="text-button" onClick={() => showCardsForArea("")}>
          すべての領域
        </button>
        {data.areas.map((a) => (
          <button
            className="area-nav"
            key={a.id}
            onClick={() => showCardsForArea(a.id)}
          >
            <span
              style={{
                background: /^#[0-9a-f]{6}$/i.test(a.color ?? "")
                  ? a.color!
                  : "#256653",
              }}
            />
            {a.name}
          </button>
        ))}
        <button
          className="text-button"
          onClick={() => showCardsForArea("none")}
        >
          未分類
        </button>
      </aside>
      <section className="cards-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR QUESTIONS</span>
            <h1>{titles[view]}</h1>
            <p className="muted">問いを育てて、自分の知識に。</p>
          </div>
          <button className="primary add-button" onClick={() => setQuick(true)}>
            ＋ クイック追加
          </button>
        </div>
        <p className="status-line" role="status">
          {notice}
        </p>
        {error && (
          <div role="alert" className="error">
            {error}
            <button
              className="text-button"
              onClick={() => void refresh().catch(() => {})}
            >
              再試行
            </button>
          </div>
        )}
        {view === "cards" && (
          <div className="list-create-actions">
            <button className="secondary" onClick={() => setDetailedAdd(true)}>
              ＋ 詳細を設定して疑問を追加
            </button>
            <span className="muted">
              重要度・労力・分類・タグ・本文・結論を設定して登録できます。
            </span>
          </div>
        )}
        {view === "settings" ? (
          <Settings data={data} userId={userId} refresh={refresh} />
        ) : (
          <>
            {(view === "cards" || view === "search" || view === "graph") && (
              <div className="tabs" aria-label="状態の切り替え">
                {[
                  ["unresolved", "疑問"],
                  ["resolved", "解決済み"],
                  ["all", "すべて"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filters.status === value}
                    onClick={() => patch({ status: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {view === "search" && (
              <div className="filters">
                <label className="search-input">
                  キーワード
                  <input
                    type="search"
                    value={filters.query}
                    onChange={(e) => patch({ query: e.target.value })}
                    placeholder="タイトル・本文・結論・分類・タグから検索"
                  />
                </label>
                <label>
                  領域
                  <select
                    value={filters.area}
                    onChange={(e) => patch({ area: e.target.value, field: "" })}
                  >
                    <option value="">すべての領域</option>
                    <option value="none">未分類</option>
                    {data.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  分野
                  <select
                    value={filters.field}
                    onChange={(e) => patch({ field: e.target.value })}
                  >
                    <option value="">すべての分野</option>
                    {data.fields
                      .filter((f) =>
                        !filters.area || filters.area === "none"
                          ? true
                          : f.area_id === filters.area,
                      )
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  重要度
                  <select
                    value={filters.importance}
                    onChange={(e) => patch({ importance: e.target.value })}
                  >
                    <option value="">すべて</option>
                    {[3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {"★".repeat(n)}
                      </option>
                    ))}
                    <option value="none">未整理</option>
                  </select>
                </label>
                <label>
                  労力
                  <select
                    value={filters.effort}
                    onChange={(e) => patch({ effort: e.target.value })}
                  >
                    <option value="">すべて</option>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="none">未設定</option>
                  </select>
                </label>
                <label>
                  タグ
                  <select
                    value={filters.tag}
                    onChange={(e) => patch({ tag: e.target.value })}
                  >
                    <option value="">すべて</option>
                    {data.tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {view === "graph" && (
              <div className="graph-filter">
                <label>
                  表示する領域
                  <select
                    value={filters.area}
                    onChange={(e) => patch({ area: e.target.value, field: "" })}
                  >
                    <option value="">領域を選択</option>
                    {data.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <div className="list-toolbar">
              <span>
                {visible.length}件{view === "trash" ? "・ゴミ箱" : ""}
              </span>
              <button
                className="text-button"
                disabled={loading || busy}
                onClick={() => void refresh().catch(() => {})}
              >
                再読み込み
              </button>
            </div>
            {loading && <p role="status">読み込み中…</p>}
            {view === "graph" ? (
              filters.area ? (
                <Suspense fallback={<p>グラフを準備中…</p>}>
                  <Graph cards={visible} data={data} open={setSelected} />
                </Suspense>
              ) : (
                <p className="empty panel">
                  グラフに表示する領域を選んでください。
                </p>
              )
            ) : (
              <>
                {!loading && !error && !visible.length && (
                  <div className="empty panel">
                    <span className="empty-icon">？</span>
                    <h2>
                      {!data.cards.length
                        ? "最初の疑問を残しましょう"
                        : "該当するカードがありません"}
                    </h2>
                    <p className="muted">
                      {view === "trash"
                        ? "削除したカードはこちらから復元できます。"
                        : view === "search"
                          ? "検索条件を変更してみてください。"
                          : "タイトルだけのクイック追加、または詳細設定付きの追加ができます。"}
                    </p>
                  </div>
                )}
                <ul className="card-list">
                  {visible.slice(0, limit).map((c, i) => (
                    <li key={c.id}>
                      {(i === 0 ||
                        visible[i - 1].importance !== c.importance) && (
                        <h3 className="group-title">
                          {c.importance ? "★".repeat(c.importance) : "未整理"}
                        </h3>
                      )}
                      <article className="question-card">
                        <span className="question-mark">
                          {c.status === "resolved" ? "✓" : "?"}
                        </span>
                        <div className="card-content">
                          <button
                            className="card-open"
                            onClick={() => setSelected(c.id)}
                          >
                            <h2>{c.title}</h2>
                          </button>
                          <div className="card-meta">
                            <span>
                              {data.areas.find((a) => a.id === c.area_id)
                                ?.name ?? "未分類"}
                              {c.field_id &&
                                ` / ${data.fields.find((f) => f.id === c.field_id)?.name ?? ""}`}
                            </span>
                            <span>
                              {c.effort
                                ? `労力：${{ low: "低", medium: "中", high: "高" }[c.effort]}`
                                : ""}
                            </span>
                            <time dateTime={c.created_at}>
                              {new Date(c.created_at).toLocaleDateString(
                                "ja-JP",
                              )}
                            </time>
                          </div>
                          <div className="chips">
                            {data.cardTags
                              .filter((ct) => ct.card_id === c.id)
                              .map((ct) => (
                                <button
                                  key={ct.tag_id}
                                  className="chip"
                                  onClick={() => {
                                    setView("search");
                                    setFilters({
                                      ...initialFilters,
                                      status: "all",
                                      tag: ct.tag_id,
                                    });
                                    setLimit(50);
                                  }}
                                >
                                  {
                                    data.tags.find((t) => t.id === ct.tag_id)
                                      ?.name
                                  }
                                </button>
                              ))}
                          </div>
                          <div className="row-actions">
                            {view === "trash" ? (
                              <>
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => void mutate(c, "restore")}
                                >
                                  復元
                                </button>
                                <button
                                  className="danger-text"
                                  disabled={busy}
                                  onClick={() => void mutate(c, "delete")}
                                >
                                  完全に削除
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() =>
                                    void mutate(
                                      c,
                                      c.status === "resolved"
                                        ? "reopen"
                                        : "resolve",
                                    )
                                  }
                                >
                                  {c.status === "resolved"
                                    ? "疑問に戻す"
                                    : "解決済みにする"}
                                </button>
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => void mutate(c, "trash")}
                                >
                                  ゴミ箱へ
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
                {visible.length > limit && (
                  <button
                    className="secondary wide"
                    onClick={() => setLimit(limit + 50)}
                  >
                    さらに表示
                  </button>
                )}
              </>
            )}
          </>
        )}
      </section>
      <nav className="mobile-nav" aria-label="メインメニュー">
        <button onClick={() => navigate("cards")}>疑問</button>
        <button onClick={() => navigate("search")}>検索</button>
        <button
          className="primary"
          aria-label="クイック登録"
          onClick={() => setQuick(true)}
        >
          ＋
        </button>
        <button onClick={() => navigate("graph")}>グラフ</button>
        <button onClick={() => navigate("settings")}>設定</button>
        <button onClick={() => navigate("trash")}>ゴミ箱</button>
      </nav>
      {quick && (
        <QuickAdd
          userId={userId}
          data={data}
          refresh={refresh}
          areaId={
            data.fields.find((field) => field.id === filters.field)?.area_id ??
            (filters.area && filters.area !== "none" ? filters.area : null)
          }
          fieldId={filters.field || null}
          close={() => setQuick(false)}
          saved={async (id, details) => {
            await refresh();
            setQuick(false);
            setNotice("保存しました。");
            if (details) setSelected(id);
          }}
        />
      )}
      {detailedAdd && (
        <QuickAdd
          mode="detailed"
          userId={userId}
          data={data}
          refresh={refresh}
          areaId={
            data.fields.find((field) => field.id === filters.field)?.area_id ??
            (filters.area && filters.area !== "none" ? filters.area : null)
          }
          fieldId={filters.field || null}
          close={() => setDetailedAdd(false)}
          saved={async () => {
            await refresh();
            setDetailedAdd(false);
            setNotice("詳細を設定して保存しました。");
          }}
        />
      )}
      {card && (
        <Suspense fallback={<p role="status">詳細を準備中…</p>}>
          <CardDetail
            key={card.id}
            card={card}
            data={data}
            userId={userId}
            refresh={refresh}
            close={() => setSelected(null)}
            navigate={setSelected}
          />
        </Suspense>
      )}
    </main>
  );
}
