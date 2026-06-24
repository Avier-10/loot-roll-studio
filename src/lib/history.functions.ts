import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin")) throw new Error("Forbidden: admin only");
}

export const softDeleteSpin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("spins").select("id, created_at, item_snapshot, spun_by").eq("id", data.id).single();
    const { error } = await supabaseAdmin
      .from("spins")
      .update({ deleted_at: new Date().toISOString(), deleted_by: ctx.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("write_audit", {
      _actor: ctx.userId,
      _action: "spin.soft_delete",
      _target_type: "spin",
      _target_table: "spins",
      _target_id: data.id as any,
      _old: before as any,
      _new: null as any,
      _metadata: {} as any,
    });
    return { ok: true };
  });

const clearInput = z.object({ confirm: z.literal("BORRAR HISTORIAL") });
export const clearAllSpins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clearInput.parse(d))
  .handler(async ({ context }) => {
    const ctx = context as any;
    await requireAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("spins").select("*", { count: "exact", head: true }).is("deleted_at", null);
    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("spins")
      .update({ deleted_at: nowIso, deleted_by: ctx.userId })
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("write_audit", {
      _actor: ctx.userId,
      _action: "spin.clear_all",
      _target_type: "spin",
      _target_table: "spins",
      _target_id: null as any,
      _old: null as any,
      _new: null as any,
      _metadata: { deleted_count: count ?? 0, deleted_at: nowIso } as any,
    });
    return { deleted: count ?? 0 };
  });
