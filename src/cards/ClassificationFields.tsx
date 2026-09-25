import { useState } from "react";
import type { Area, Field, Notebook } from "../data/types";
import { ensureNamed } from "../data/repository";
import { InlineCreate } from "../components/InlineCreate";

export function ClassificationFields({
  data,
  userId,
  areaId,
  fieldId,
  change,
  disabled,
  onBusyChange,
  refresh,
}: {
  data: Notebook;
  userId: string;
  areaId: string | null;
  fieldId: string | null;
  change: (areaId: string | null, fieldId: string | null) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const [createdAreas, setAreas] = useState<Area[]>([]);
  const [createdFields, setFields] = useState<Field[]>([]);
  const areas = [
    ...new Map([...data.areas, ...createdAreas].map((a) => [a.id, a])).values(),
  ];
  const fields = [
    ...new Map(
      [...data.fields, ...createdFields].map((f) => [f.id, f]),
    ).values(),
  ];
  return (
    <>
      <div>
        <label>
          領域
          <select
            value={areaId ?? ""}
            disabled={disabled}
            onChange={(e) => change(e.target.value || null, null)}
          >
            <option value="">未分類</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <InlineCreate
          label="領域"
          disabled={disabled}
          onBusyChange={onBusyChange}
          create={async (name) => {
            const a = await ensureNamed(userId, "areas", name);
            setAreas((prev) => [...prev, a as Area]);
            change(a.id, null);
            await refresh();
          }}
        />
      </div>
      <div>
        <label>
          分野
          <select
            value={fieldId ?? ""}
            disabled={disabled || !areaId}
            onChange={(e) => change(areaId, e.target.value || null)}
          >
            <option value="">未設定</option>
            {fields
              .filter((f) => f.area_id === areaId)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </label>
        <InlineCreate
          key={areaId ?? "none"}
          label="分野"
          disabled={disabled || !areaId}
          onBusyChange={onBusyChange}
          create={async (name) => {
            const f = await ensureNamed(userId, "fields", name, areaId!);
            setFields((prev) => [...prev, f as Field]);
            change(areaId, f.id);
            await refresh();
          }}
        />
        {!areaId && (
          <small className="muted">
            先に領域を選択、または新規作成してください。
          </small>
        )}
      </div>
    </>
  );
}
