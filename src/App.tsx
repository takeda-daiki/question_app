import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { AuthForm } from "./auth/AuthForm";
import { NotebookApp } from "./NotebookApp";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      authEvent = true;
      if (active) {
        setSession(next);
        setReady(true);
        setError("");
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authEvent) return;
        setSession(data.session);
        setReady(true);
        if (error)
          setError(
            "ログイン状態を確認できませんでした。再読み込みしてください。",
          );
      })
      .catch(() => {
        if (active && !authEvent) {
          setReady(true);
          setError("接続できませんでした。再読み込みしてください。");
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    setLeaving(true);
    setError("");
    try {
      const { error } = await supabase!.auth.signOut({ scope: "local" });
      if (error) throw error;
      setSession(null);
    } catch {
      setError("ログアウトできませんでした。もう一度お試しください。");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <a className="brand" href="./">
          <span className="brand-icon">?</span>疑問ノート
        </a>
        {session && (
          <div className="account">
            <span title={session.user.email}>{session.user.email}</span>
            <button
              className="secondary"
              disabled={leaving}
              onClick={() => void logout()}
            >
              {leaving ? "処理中…" : "ログアウト"}
            </button>
          </div>
        )}
      </header>
      {error && (
        <p className="error global-error" role="alert">
          {error}
        </p>
      )}
      {!supabase ? (
        <main className="setup panel">
          <h1>接続設定をしましょう</h1>
          <p>
            アプリの準備ができました。Supabaseの接続先を設定すると、ログインして使えます。
          </p>
          <p>
            <code>.env.example</code> を <code>.env.local</code>{" "}
            にコピーし、Project URLとPublishable
            keyを入力して再起動してください。
          </p>
          <p>
            詳しい手順は <code>docs/STEP6.md</code> にあります。
          </p>
        </main>
      ) : !ready ? (
        <p className="loading" role="status">
          ログイン状態を確認中…
        </p>
      ) : session ? (
        <NotebookApp key={session.user.id} userId={session.user.id} />
      ) : (
        <AuthForm />
      )}
      <footer>疑問を残す。学びが続く。</footer>
    </>
  );
}
