import { supabase } from "../lib/supabase";
import type { Area, Card, Field, Notebook, Tag } from "./types";

// Read every page, including the trash. Filters and export must not silently lose rows.
async function readAll<T>(table: string, userId: string): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase!.from(table).select("*").eq("user_id", userId);
    query =
      table === "qm_card_tags"
        ? query.order("card_id").order("tag_id")
        : query.order("id");
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw error;
    all.push(...(data as T[]));
    if (data.length < 500) return all;
  }
}
export async function loadNotebook(userId: string): Promise<Notebook> {
  const [cards, areas, fields, tags, cardTags, links] = await Promise.all([
    readAll<Notebook["cards"][number]>("qm_cards", userId),
    readAll<Notebook["areas"][number]>("qm_areas", userId),
    readAll<Notebook["fields"][number]>("qm_fields", userId),
    readAll<Notebook["tags"][number]>("qm_tags", userId),
    readAll<Notebook["cardTags"][number]>("qm_card_tags", userId),
    readAll<Notebook["links"][number]>("qm_card_links", userId),
  ]);
  return {
    cards,
    areas: areas.sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    ),
    fields: fields.sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    ),
    tags,
    cardTags,
    links,
  };
}
export type CardChanges = Pick<
  Card,
  | "title"
  | "body"
  | "conclusion"
  | "area_id"
  | "field_id"
  | "importance"
  | "effort"
  | "status"
>;
export async function updateCard(
  userId: string,
  original: Card,
  changes: Partial<CardChanges & Pick<Card, "deleted_at">>,
) {
  let query = supabase!
    .from("qm_cards")
    .update(changes)
    .eq("id", original.id)
    .eq("user_id", userId);
  if (original.updated_at) query = query.eq("updated_at", original.updated_at);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      "別の画面で変更された可能性があります。入力を控え、閉じて再読み込みしてからお試しください。",
    );
  return data as Card;
}
export async function permanentlyDelete(userId: string, card: Card) {
  if (!card.deleted_at) throw new Error("先にゴミ箱へ移動してください。");
  const { data, error } = await supabase!
    .from("qm_cards")
    .delete()
    .eq("user_id", userId)
    .eq("id", card.id)
    .eq("deleted_at", card.deleted_at)
    .eq("updated_at", card.updated_at)
    .select("id");
  if (error) throw error;
  if (!data.length)
    throw new Error("カードの状態が変わりました。再読み込みしてください。");
}
export async function createNamed(
  userId: string,
  kind: "areas" | "fields" | "tags",
  name: string,
  extra: Record<string, unknown> = {},
) {
  if (!name.trim()) throw new Error("名前を入力してください。");
  const { error } = await supabase!
    .from(`qm_${kind}`)
    .insert({ ...extra, user_id: userId, name: name.trim() });
  if (error) throw error;
}

// Recover an existing name after a lost response or concurrent creation.
export async function ensureNamed(
  userId: string,
  kind: "areas" | "fields" | "tags",
  name: string,
  areaId?: string,
): Promise<Area | Field | Tag> {
  const clean = name.trim();
  if (!clean) throw new Error("名前を入力してください。");
  if (kind === "fields" && !areaId)
    throw new Error("先に領域を選択してください。");
  const { data, error } = await supabase!
    .from(`qm_${kind}`)
    .insert({
      user_id: userId,
      name: clean,
      ...(kind === "fields" ? { area_id: areaId } : {}),
    })
    .select("*")
    .single();
  if (!error) return data;
  if (error.code === "23505") {
    let query = supabase!
      .from(`qm_${kind}`)
      .select("*")
      .eq("user_id", userId)
      .eq("name", clean);
    if (kind === "fields") query = query.eq("area_id", areaId!);
    const existing = await query.single();
    if (!existing.error) return existing.data;
  }
  throw error;
}
export async function editNamed(
  userId: string,
  kind: "areas" | "fields" | "tags",
  id: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase!
    .from(`qm_${kind}`)
    .update(values)
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}
export async function deleteNamed(
  userId: string,
  kind: "areas" | "fields" | "tags",
  id: string,
) {
  const { data, error } = await supabase!
    .from(`qm_${kind}`)
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data.length)
    throw new Error("対象が変更されています。再読み込みしてください。");
}
export async function setTag(
  userId: string,
  cardId: string,
  tagId: string,
  enabled: boolean,
) {
  const result = enabled
    ? await supabase!
        .from("qm_card_tags")
        .insert({ user_id: userId, card_id: cardId, tag_id: tagId })
    : await supabase!
        .from("qm_card_tags")
        .delete()
        .eq("user_id", userId)
        .eq("card_id", cardId)
        .eq("tag_id", tagId);
  if (result.error && !(enabled && result.error.code === "23505"))
    throw result.error;
}
export async function addLink(userId: string, a: string, b: string) {
  if (a === b) throw new Error("別のカードを選んでください。");
  const [card_a_id, card_b_id] = [a, b].sort();
  const { error } = await supabase!
    .from("qm_card_links")
    .insert({ user_id: userId, card_a_id, card_b_id });
  if (error && error.code !== "23505") throw error;
}
export async function removeLink(userId: string, id: string) {
  const { error } = await supabase!
    .from("qm_card_links")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
export function failure(error: unknown) {
  if (error instanceof Error) return error.message;
  return "保存できませんでした。通信状態を確認して再試行してください。名前の重複やアクセス権もご確認ください。";
}
