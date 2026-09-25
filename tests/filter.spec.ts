import { test, expect } from "@playwright/test";
import { filterCards, initialFilters } from "../src/cards/filter";
import { emptyNotebook, type Card, type Notebook } from "../src/data/types";

function card(id: string, values: Partial<Card>): Card {
  return {
    id,
    user_id: "user-a",
    title: id,
    body: null,
    conclusion: null,
    area_id: null,
    field_id: null,
    importance: null,
    effort: null,
    status: "unresolved",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    resolved_at: null,
    deleted_at: null,
    ...values,
  };
}
test("priority then effort; unorganized is newest first and trash is excluded", () => {
  const data: Notebook = {
    ...emptyNotebook,
    cards: [
      card("new-unorganized", {
        created_at: "2026-09-25T00:00:00Z",
        effort: "high",
      }),
      card("old-unorganized", { effort: "low" }),
      card("three-high", { importance: 3, effort: "high" }),
      card("three-low", { importance: 3, effort: "low" }),
      card("two", { importance: 2 }),
      card("trashed", { importance: 3, deleted_at: "2026-09-25T00:00:00Z" }),
      card("resolved", { status: "resolved" }),
    ],
  };
  expect(filterCards(data, initialFilters).map((c) => c.id)).toEqual([
    "three-low",
    "three-high",
    "two",
    "new-unorganized",
    "old-unorganized",
  ]);
  expect(
    filterCards(data, { ...initialFilters, status: "all" }, true).map(
      (c) => c.id,
    ),
  ).toEqual(["trashed"]);
});
test("search spans conclusion, area, field and tags with combined filters", () => {
  const data: Notebook = {
    ...emptyNotebook,
    cards: [
      card("target", {
        conclusion: "ベイズ更新",
        area_id: "a",
        field_id: "f",
        importance: 2,
        effort: "low",
      }),
    ],
    areas: [
      { id: "a", user_id: "user-a", name: "研究", color: null, sort_order: 0 },
    ],
    fields: [
      { id: "f", user_id: "user-a", name: "統計", area_id: "a", sort_order: 0 },
    ],
    tags: [{ id: "t", user_id: "user-a", name: "論文" }],
    cardTags: [{ user_id: "user-a", card_id: "target", tag_id: "t" }],
  };
  expect(
    filterCards(data, {
      ...initialFilters,
      query: "ベイズ 研究 統計 論文",
      area: "a",
      field: "f",
      importance: "2",
      effort: "low",
      tag: "t",
    }),
  ).toHaveLength(1);
  expect(filterCards(data, { ...initialFilters, tag: "other" })).toHaveLength(
    0,
  );
});
