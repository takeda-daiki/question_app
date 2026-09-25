import { supabase } from "../lib/supabase";

export type Card = { id: string; title: string; created_at: string };

export type NewCardDetails = {
  status?: "unresolved" | "resolved";
  importance?: number | null;
  effort?: "low" | "medium" | "high" | null;
  body?: string | null;
  conclusion?: string | null;
};

export async function addCard(
  userId: string,
  id: string,
  title: string,
  areaId: string | null = null,
  fieldId: string | null = null,
  details?: NewCardDetails,
): Promise<Card> {
  const value = title.trim();
  if (!value) throw new Error("タイトルを入力してください。");
  const { data, error } = await supabase!
    .from("qm_cards")
    .insert({
      id,
      user_id: userId,
      title: value,
      ...(areaId ? { area_id: areaId, field_id: fieldId } : {}),
      ...(details
        ? {
            status: details.status ?? "unresolved",
            resolved_at:
              details.status === "resolved" ? new Date().toISOString() : null,
            importance: details.importance ?? null,
            effort: details.effort ?? null,
            body: details.body?.trim() || null,
            conclusion: details.conclusion?.trim() || null,
          }
        : {}),
    })
    .select("id,title,created_at")
    .single();
  if (!error) return data;
  // A response can be lost after an insert succeeds. Reuse the attempt ID on retry.
  if (error.code === "23505") {
    const existing = await supabase!
      .from("qm_cards")
      .select("id,title,created_at")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (!existing.error) return existing.data;
  }
  throw error;
}
