import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const categorySchema = z.enum(["bueno", "muy_bueno", "excelente", "leve", "medio", "fuerte"]);
const typeSchema = z.enum(["beneficio", "castigo"]);

async function requireRoles(ctx: { supabase: any; userId: string }, allowed: string[]) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => allowed.includes(r))) {
    throw new Error(`Forbidden: required one of ${allowed.join(", ")}`);
  }
  return roles as string[];
}

async function audit(
  actor: string,
  action: string,
  targetType: string,
  targetTable: string,
  targetId: string | null,
  oldValue: unknown,
  newValue: unknown,
  metadata: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.rpc("write_audit", {
    _actor: actor,
    _action: action,
    _target_type: targetType,
    _target_table: targetTable,
    _target_id: targetId,
    _old: (oldValue ?? null) as any,
    _new: (newValue ?? null) as any,
    _metadata: metadata as any,
  });
}

const createInput = z.object({
  type: typeSchema,
  category: categorySchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
});
export const createItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin", "moderator"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("items")
      .insert({ ...data, created_by: ctx.userId })
      .select("*").single();
    if (error) throw new Error(error.message);
    await audit(ctx.userId, "item.create", "item", "items", row.id, null, row);
    return row;
  });

const updateInput = z.object({
  id: z.string().uuid(),
  type: typeSchema.optional(),
  category: categorySchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  is_active: z.boolean().optional(),
});
export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { data: before } = await supabaseAdmin.from("items").select("*").eq("id", id).single();
    const { data: after, error } = await supabaseAdmin
      .from("items").update(patch).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    await audit(ctx.userId, "item.update", "item", "items", id, before, after);
    return after;
  });

export const softDeleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("items").select("*").eq("id", data.id).single();
    const { data: after, error } = await supabaseAdmin
      .from("items")
      .update({ deleted_at: new Date().toISOString(), deleted_by: ctx.userId, is_active: false })
      .eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    await audit(ctx.userId, "item.soft_delete", "item", "items", data.id, before, after);
    return { ok: true };
  });

export const restoreItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("items").select("*").eq("id", data.id).single();
    const { data: after, error } = await supabaseAdmin
      .from("items")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    await audit(ctx.userId, "item.restore", "item", "items", data.id, before, after);
    return { ok: true };
  });

export const hardDeleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), confirm: z.literal("ELIMINAR") }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("items").select("*").eq("id", data.id).single();
    if (!before?.deleted_at) throw new Error("Solo se pueden eliminar definitivamente elementos en la papelera.");
    const { error } = await supabaseAdmin.from("items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx.userId, "item.hard_delete", "item", "items", data.id, before, null);
    return { ok: true };
  });

export const listTrash = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRoles(context as any, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("items").select("*").not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
