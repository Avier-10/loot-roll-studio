export type ItemType = "beneficio" | "castigo";
export type ItemCategory =
  | "bueno"
  | "muy_bueno"
  | "excelente"
  | "leve"
  | "medio"
  | "fuerte";

export interface Item {
  id: string;
  type: ItemType;
  category: ItemCategory;
  title: string;
  description: string;
  is_active: boolean;
  suggested_by_username: string | null;
  suggested_at: string | null;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface SpinResult {
  item: Item;
  spinId: string;
}
