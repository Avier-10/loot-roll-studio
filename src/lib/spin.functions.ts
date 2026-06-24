import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROBABILITIES } from "@/config/probabilities";
import type { Item } from "./types";

/**
 * Authoritative server-side spin.
 * - Validates role (admin/streamer) and active account status
 * - Acquires a per-user atomic spin lock (1 active spin at a time)
 * - Records the spin and marks it as pending visualization
 * The lock auto-expires after 30s (handled in DB function) to avoid permanent
 * blocks if the client crashes mid-animation.
 */
export const performSpin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // 1. Authorize role
    const { data: rolesRows, error: rolesErr } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (rolesErr) throw new Error(rolesErr.message);
    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("streamer")) {
      throw new Error("Forbidden: required role streamer or admin");
    }

    // 2. Account must be active
    const { data: status } = await supabase.rpc("get_account_status", { _uid: userId });
    if (status !== "activo") {
      throw new Error("Cuenta no activa. Contactá a un administrador.");
    }

    // 3. Privileged operations: spin lock + pick + insert
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 3a. Acquire atomic lock with a pre-generated spin id
    const spinId = crypto.randomUUID();
    const { data: acquired, error: lockErr } = await supabaseAdmin.rpc("acquire_spin_lock", {
      _uid: userId, _spin_id: spinId,
    });
    if (lockErr) throw new Error(lockErr.message);
    if (!acquired) {
      throw new Error("Ya hay un giro en curso. Esperá a que termine.");
    }

    try {
      // 3b. Weighted pick of category (server-side RNG)
      const total = PROBABILITIES.reduce((s, p) => s + p.weight, 0);
      let r = Math.random() * total;
      let chosen = PROBABILITIES[0];
      for (const p of PROBABILITIES) {
        if (r < p.weight) { chosen = p; break; }
        r -= p.weight;
      }

      let { data: items, error: itemsErr } = await supabaseAdmin
        .from("items").select("*").eq("category", chosen.category).eq("is_active", true);
      if (itemsErr) throw new Error(itemsErr.message);
      if (!items || items.length === 0) {
        const fallback = await supabaseAdmin.from("items").select("*").eq("is_active", true);
        items = fallback.data ?? [];
      }
      if (!items || items.length === 0) {
        throw new Error("No hay elementos disponibles en el pool.");
      }
      const item = items[Math.floor(Math.random() * items.length)] as Item;

      // 3c. Insert spin with the locked id
      const { error: insErr } = await supabaseAdmin
        .from("spins")
        .insert({ id: spinId, item_id: item.id, item_snapshot: item as unknown as Record<string, unknown>, spun_by: userId });
      if (insErr) throw new Error(insErr.message);

      // 3d. Release lock and mark pending
      await supabaseAdmin.rpc("release_spin_lock", { _uid: userId, _pending_spin_id: spinId });

      return { item, spinId };
    } catch (e) {
      // Release lock on error to avoid permanent block (no pending result)
      await supabaseAdmin.rpc("release_spin_lock", { _uid: userId, _pending_spin_id: spinId });
      throw e;
    }
  });

/** Returns the pending (unviewed) spin for the current user, if any. */
export const getPendingSpin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: profile } = await supabase
      .from("profiles").select("pending_spin_id").eq("id", userId).single();
    const pid = profile?.pending_spin_id as string | null | undefined;
    if (!pid) return { spin: null as null | { id: string; item: Item } };
    const { data: spin } = await supabase
      .from("spins").select("id, item_snapshot").eq("id", pid).maybeSingle();
    if (!spin) return { spin: null };
    return { spin: { id: spin.id as string, item: spin.item_snapshot as Item } };
  });

/** Marks the current user's pending spin as viewed and clears it. */
export const acknowledgePendingSpin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("clear_pending_spin", { _uid: userId });
    return { ok: true };
  });
