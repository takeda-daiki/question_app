import { useRef, useState } from "react";
import { failure } from "../data/repository";

// Can live inside a card form: never creates a nested form or submits the card.
export function InlineCreate({
  label,
  disabled,
  create,
  onBusyChange,
}: {
  label: string;
  disabled?: boolean;
  create: (name: string) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit() {
    if (lock.current || disabled || !name.trim()) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await create(name.trim());
      setName("");
      setOpen(false);
    } catch (e) {
      setError(failure(e));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="inline-create">
      {!open ? (
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          ＋ {label}を新規作成
        </button>
      ) : (
        <>
          <label>
            新しい{label}名
            <input
              autoFocus
              value={name}
              disabled={disabled || busy}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="secondary"
              disabled={disabled || busy}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="primary"
              disabled={disabled || busy || !name.trim()}
              onClick={() => void submit()}
            >
              {busy ? "作成中…" : `${label}を作成して選択`}
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
