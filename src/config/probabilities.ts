// Centralized probability configuration.
// Modify these weights at any time. They are applied on the server.
// Weights are relative (do not need to sum to 100).

import type { ItemCategory, ItemType } from "./types";

export interface CategoryConfig {
  type: ItemType;
  category: ItemCategory;
  weight: number;
  label: string;
  color: string; // CSS variable name
}

export const PROBABILITIES: CategoryConfig[] = [
  { type: "beneficio", category: "bueno",      weight: 30, label: "Bueno",      color: "cat-bueno" },
  { type: "beneficio", category: "muy_bueno",  weight: 20, label: "Muy Bueno",  color: "cat-muy-bueno" },
  { type: "beneficio", category: "excelente",  weight: 5,  label: "Excelente",  color: "cat-excelente" },
  { type: "castigo",   category: "leve",       weight: 25, label: "Leve",       color: "cat-leve" },
  { type: "castigo",   category: "medio",      weight: 15, label: "Medio",      color: "cat-medio" },
  { type: "castigo",   category: "fuerte",     weight: 5,  label: "Fuerte",     color: "cat-fuerte" },
];

export function categoryConfig(category: ItemCategory): CategoryConfig {
  const c = PROBABILITIES.find((p) => p.category === category);
  if (!c) throw new Error(`Unknown category: ${category}`);
  return c;
}
