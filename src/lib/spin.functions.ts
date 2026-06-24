import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROBABILITIES } from "@/config/probabilities";
import type { Item } from "./types";

/**
 * Performs a roulette spin on the server.
 * Authoritative: never trust client-side randomness.
 *  1. Picks a category by weighted random
 *  2. Picks a random active item in that category
 *  3. Inserts a spin record
 *  4. Returns the chosen item + spin id
 */
export const performSpin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // Authorize: only admins and streamers can spin
    const { data: rolesRows, error: rolesErr } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (rolesErr) throw new Error(rolesErr.message);
    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("streamer")) {
      throw new Error("Forbidden: required role streamer or admin");
    }

    // Weighted pick of category
    const total = PROBABILITIES.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    let chosen = PROBABILITIES[0];
    for (const p of PROBABILITIES) {
      if (r < p.weight) { chosen = p; break; }
      r -= p.weight;
    }

    // Pick a random active item in that category. If none, fall back to any active item.
    let { data: items, error: itemsErr } = await supabase
      .from("items").select("*").eq("category", chosen.category).eq("is_active", true);
    if (itemsErr) throw new Error(itemsErr.message);
    if (!items || items.length === 0) {
      const fallback = await supabase.from("items").select("*").eq("is_active", true);
      items = fallback.data ?? [];
    }
    if (!items || items.length === 0) {
      throw new Error("No hay elementos disponibles en el pool. Crea contenido en el panel de administración.");
    }
    const item = items[Math.floor(Math.random() * items.length)] as Item;

    // Record spin
    const { data: spin, error: spinErr } = await supabase
      .from("spins")
      .insert({ item_id: item.id, item_snapshot: item, spun_by: userId })
      .select("id").single();
    if (spinErr) throw new Error(spinErr.message);

    return { item, spinId: spin.id as string };
  });
