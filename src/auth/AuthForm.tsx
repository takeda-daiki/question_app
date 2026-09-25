import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

export function AuthForm() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !supabase) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const credentials = {
      email: String(values.get("email")).trim(),
      password: String(values.get("password")),
    };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = signup
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
      if (result.error) {
        if (result.error.code === "email_not_confirmed") {
          setError("確認メールのリンクを開いてから、ログインしてください。");
        } else if (signup) {
          setError(
            "登録できませんでした。メールアドレス、パスワードの条件、通信状態を確認してください。",
          );
        } else {
          setError(
            "ログインできませんでした。メールアドレスとパスワード、通信状態を確認してください。",
          );
        }
      } else if (signup && !result.data.session) {
        form.reset();
        setMessage(
          "確認メールが届いたら、リンクを開いて登録を完了してください。その後、この画面からログインできます。",
        );
      }
    } catch {
      setError(
        "接続できませんでした。通信状態を確認して、もう一度お試しください。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="welcome">
      <section className="intro">
        <span className="eyebrow">QUESTION NOTE</span>
        <h1>
          その疑問が、
          <br />
          知識のはじまり。
        </h1>
        <p>
          ふと浮かんだ「なぜ？」を、忘れる前に。
          <br />
          まずはタイトルだけ。整理はあとから。
        </p>
        <div className="sample-note" aria-hidden="true">
          <span>たとえば、こんな疑問</span>
          <p>ベイズ推定とは？</p>
          <small>小さな問いを、ひとつずつ。</small>
        </div>
      </section>
      <section className="auth panel" aria-labelledby="auth-title">
        <h2 id="auth-title">
          {signup ? "アカウントを作成" : "おかえりなさい"}
        </h2>
        <p className="muted">
          {signup
            ? "メールアドレスで、疑問の記録を始めましょう。"
            : "ログインして、あなたの疑問を開きましょう。"}
        </p>
        <form onSubmit={submit}>
          <label htmlFor="email">メールアドレス</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={busy}
          />
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 8 : undefined}
            required
            disabled={busy}
          />
          {signup && (
            <small className="muted">
              8文字以上。接続先で設定された条件も適用されます。
            </small>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <button className="primary wide" disabled={busy}>
            {busy ? "接続中…" : signup ? "アカウントを作成" : "ログイン"}
          </button>
        </form>
        <button
          className="text-button wide"
          disabled={busy}
          onClick={() => {
            setSignup(!signup);
            setError("");
            setMessage("");
          }}
        >
          {signup ? "ログインに戻る" : "初めての方はこちら"}
        </button>
      </section>
    </main>
  );
}
