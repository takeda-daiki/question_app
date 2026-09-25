import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addCard, listCards, PAGE_SIZE, type Card } from './api';

export function CardList({ userId }: { userId: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [more, setMore] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const active = useRef(true);
  const request = useRef(0);
  const saveLock = useRef(false);
  const attempt = useRef<{ id: string; title: string } | null>(null);

  async function load(append = false) {
    const version = ++request.current;
    setLoading(true); setLoadError(false);
    try {
      const rows = await listCards(userId, append ? cards.length : 0);
      if (!active.current || version !== request.current) return;
      setCards(previous => append ? [...new Map([...previous, ...rows].map(c => [c.id, c])).values()] : rows);
      setMore(rows.length === PAGE_SIZE);
    } catch {
      if (active.current && version === request.current) setLoadError(true);
    } finally {
      if (active.current && version === request.current) setLoading(false);
    }
  }

  useEffect(() => {
    active.current = true;
    void load();
    return () => { active.current = false; request.current++; };
  }, [userId]);

  function open() {
    setNotice(''); dialog.current?.showModal(); input.current?.focus();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saveLock.current) return;
    const clean = title.trim();
    if (!clean) { setSaveError('タイトルを入力してください。'); return; }
    if (!attempt.current || attempt.current.title !== clean) attempt.current = { id: crypto.randomUUID(), title: clean };
    saveLock.current = true; setSaving(true); setSaveError('');
    try {
      await addCard(userId, attempt.current.id, clean);
      if (!active.current) return;
      setTitle(''); attempt.current = null;
      dialog.current?.close(); addButton.current?.focus();
      setNotice('保存しました。');
      await load();
    } catch {
      if (active.current) setSaveError('保存を確認できませんでした。入力は残っています。通信状態を確認して再試行してください。続く場合は接続設定とRLSを確認してください。');
    } finally {
      saveLock.current = false;
      if (active.current) setSaving(false);
    }
  }

  return <main className="workspace">
    <aside className="sidebar"><span className="eyebrow">MY NOTEBOOK</span><p className="selected">疑問一覧</p><p className="sidebar-note">気になったことを、<br />ひとつずつ残そう。</p></aside>
    <section className="cards-section">
      <div className="section-heading"><div><span className="eyebrow">YOUR QUESTIONS</span><h1>疑問一覧</h1><p className="muted">答えを見つける、その前に。</p></div><button ref={addButton} className="primary add-button" onClick={open}>＋ 疑問を追加</button></div>
      <p className="status-line" role="status">{notice}</p>
      <div className="list-toolbar"><span>記録した疑問</span><button className="text-button" disabled={loading || saving} onClick={() => void load()}>再読み込み</button></div>
      {loadError && <div className="error" role="alert">一覧を読み込めませんでした。通信状態と接続設定を確認してください。<button className="text-button" onClick={() => void load()}>再試行</button></div>}
      {loading && <p role="status" className="muted">読み込み中…</p>}
      {!loading && !loadError && cards.length === 0 && <div className="empty panel"><span className="empty-icon" aria-hidden="true">？</span><h2>最初の疑問を残しましょう</h2><p className="muted">「ベイズ推定とは？」など、タイトルだけで大丈夫。</p><button className="text-button" onClick={open}>＋ 疑問を追加する</button></div>}
      <ul className="card-list">{cards.map(card => <li className="question-card" key={card.id}><span className="question-mark" aria-hidden="true">?</span><div><h2>{card.title}</h2><time dateTime={card.created_at}>{new Date(card.created_at).toLocaleDateString('ja-JP')}</time></div></li>)}</ul>
      {more && !loadError && <button className="secondary wide" disabled={loading || saving} onClick={() => void load(true)}>さらに表示</button>}
    </section>
    <dialog ref={dialog} onCancel={event => { if (saveLock.current) event.preventDefault(); }}>
      <form onSubmit={save}>
        <span className="eyebrow">A NEW QUESTION</span><h2>いま、気になっていることは？</h2>
        <p className="muted">まずはタイトルだけ。短い言葉で大丈夫。</p>
        <label htmlFor="card-title">疑問のタイトル</label>
        <input ref={input} id="card-title" value={title} onChange={event => { setTitle(event.target.value); setSaveError(''); }} placeholder="例：ベイズ推定とは？" required disabled={saving} autoComplete="off" />
        {saveError && <p className="error" role="alert">{saveError}</p>}
        <div className="dialog-actions"><button className="secondary" type="button" disabled={saving} onClick={() => dialog.current?.close()}>閉じる</button><button className="primary" disabled={saving || !title.trim()}>{saving ? '保存中…' : '保存する'}</button></div>
      </form>
    </dialog>
  </main>;
}
