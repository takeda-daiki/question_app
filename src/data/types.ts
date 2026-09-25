export type Card = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  conclusion: string | null;
  area_id: string | null;
  field_id: string | null;
  importance: number | null;
  effort: "low" | "medium" | "high" | null;
  status: "unresolved" | "resolved";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  deleted_at: string | null;
};
export type Area = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  sort_order: number;
};
export type Field = {
  id: string;
  user_id: string;
  area_id: string;
  name: string;
  sort_order: number;
};
export type Tag = { id: string; user_id: string; name: string };
export type CardTag = { user_id: string; card_id: string; tag_id: string };
export type Link = {
  id: string;
  user_id: string;
  card_a_id: string;
  card_b_id: string;
};
export type Notebook = {
  cards: Card[];
  areas: Area[];
  fields: Field[];
  tags: Tag[];
  cardTags: CardTag[];
  links: Link[];
};
export const emptyNotebook: Notebook = {
  cards: [],
  areas: [],
  fields: [],
  tags: [],
  cardTags: [],
  links: [],
};
