import { useState } from "react";
import { InlineCreate } from "./InlineCreate";
import { ensureNamed } from "../data/repository";

export function FilterCreate({
  label,
  kind,
  userId,
  areaId,
  refresh,
  select,
}: {
  label: string;
  kind: "areas" | "fields" | "tags";
  userId: string;
  areaId?: string;
  refresh: () => Promise<void>;
  select: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const needsArea = kind === "fields" && (!areaId || areaId === "none");
  return (
    <>
      <InlineCreate
        label={label}
        disabled={busy || needsArea}
        onBusyChange={setBusy}
        create={async (name) => {
          const item = await ensureNamed(userId, kind, name, areaId);
          await refresh();
          select(item.id);
        }}
      />
      {needsArea && (
        <small className="muted">
          分野を追加するには領域を選択してください。
        </small>
      )}
    </>
  );
}
