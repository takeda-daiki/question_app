import type { Card, Notebook } from "../data/types";
export type Filters = {
  query: string;
  status: string;
  area: string;
  field: string;
  importance: string;
  effort: string;
  tag: string;
};
export const initialFilters: Filters = {
  query: "",
  status: "unresolved",
  area: "",
  field: "",
  importance: "",
  effort: "",
  tag: "",
};
export function filterCards(
  data: Notebook,
  filter: Filters,
  trash = false,
): Card[] {
  const words = filter.query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const effortOrder = { low: 0, medium: 1, high: 2 };
  return data.cards
    .filter((c) => {
      if (Boolean(c.deleted_at) !== trash) return false;
      if (filter.status !== "all" && c.status !== filter.status) return false;
      if (
        filter.area &&
        (filter.area === "none" ? c.area_id != null : c.area_id !== filter.area)
      )
        return false;
      if (filter.field && c.field_id !== filter.field) return false;
      if (
        filter.importance &&
        (filter.importance === "none"
          ? c.importance != null
          : c.importance !== Number(filter.importance))
      )
        return false;
      if (
        filter.effort &&
        (filter.effort === "none"
          ? c.effort != null
          : c.effort !== filter.effort)
      )
        return false;
      const tagIds = data.cardTags
        .filter((t) => t.card_id === c.id)
        .map((t) => t.tag_id);
      if (filter.tag && !tagIds.includes(filter.tag)) return false;
      const haystack = [
        c.title,
        c.body,
        c.conclusion,
        data.areas.find((a) => a.id === c.area_id)?.name,
        data.fields.find((f) => f.id === c.field_id)?.name,
        ...data.tags.filter((t) => tagIds.includes(t.id)).map((t) => t.name),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .sort(
      (a, b) =>
        (b.importance ?? 0) - (a.importance ?? 0) ||
        (a.importance == null
          ? 0
          : (effortOrder[a.effort!] ?? 3) - (effortOrder[b.effort!] ?? 3)) ||
        b.created_at.localeCompare(a.created_at) ||
        a.id.localeCompare(b.id),
    );
}
