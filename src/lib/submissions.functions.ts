import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const categorySchema = z.enum(["bueno", "muy_bueno", "excelente", "leve", "medio", "fuerte"]);
const typeSchema = z.enum(["beneficio", "castigo"]);

async function requireMod(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("moderator")) {
    throw new Error("Forbidden: admin or moderator required");
  }
}

async function writeAudit(actor: string, action: string, targetId: string | null, oldV: unknown, newV: unknown, meta: Record<string, unknown> = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.rpc("write_audit", {
    _actor: actor,
    _action: action,
    _target_type: "submission",
    _target_table: "pending_submissions",
    _target_id: targetId as any,
    _old: (oldV ?? null) as any,
    _new: (newV ?? null) as any,
    _metadata: meta as any,
  });
}

async function recordHistory(args: {
  submissionId: string | null;
  moderatorId: string;
  action: string;
  platform: string | null;
  externalUsername: string | null;
  original: unknown;
  final: unknown;
  reason?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("moderation_history").insert({
    submission_id: args.submissionId,
    moderator_id: args.moderatorId,
    action: args.action,
    platform: args.platform,
    external_username: args.externalUsername,
    original_content: args.original as any,
    final_content: args.final as any,
    reason: args.reason ?? null,
  });
}

const listFilter = z.object({
  status: z.enum(["pendiente", "aprobado", "rechazado", "todos"]).default("pendiente"),
  type: z.enum(["beneficio", "castigo", "todos"]).default("todos"),
  platform: z.string().trim().max(40).optional(),
});

export const listSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listFilter.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireMod(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("pending_submissions").select("*").order("created_at", { ascending: false });
    if (data.status !== "todos") q = q.eq("status", data.status);
    if (data.type !== "todos") q = q.eq("proposed_type", data.type);
    if (data.platform) q = q.eq("platform", data.platform.toLowerCase());
    const { data: rows, error } = await q.limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const approveInput = z.object({
  id: z.string().uuid(),
  type: typeSchema,
  category: categorySchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
});

export const approveSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => approveInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireMod(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sub, error: e0 } = await supabaseAdmin
      .from("pending_submissions").select("*").eq("id", data.id).single();
    if (e0 || !sub) throw new Error(e0?.message ?? "Sugerencia no encontrada");
    if (sub.status !== "pendiente") throw new Error("La sugerencia ya fue revisada.");

    const { data: item, error: e1 } = await supabaseAdmin.from("items").insert({
      type: data.type,
      category: data.category,
      title: data.title,
      description: data.description,
      suggested_by_username: sub.kick_username,
      suggested_at: sub.created_at,
      created_by: ctx.userId,
    }).select("*").single();
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await supabaseAdmin.from("pending_submissions").update({
      status: "aprobado",
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      approved_item_id: item.id,
      proposed_type: data.type,
      proposed_category: data.category,
      proposed_title: data.title,
      proposed_description: data.description,
    }).eq("id", data.id);
    if (e2) throw new Error(e2.message);

    await writeAudit(ctx.userId, "submission.approve", data.id, sub, { ...sub, approved_item_id: item.id }, { item_id: item.id });
    await writeAudit(ctx.userId, "item.create_from_submission", item.id, null, item, { submission_id: data.id });
    await recordHistory({
      submissionId: data.id,
      moderatorId: ctx.userId,
      action: "aprobado",
      platform: (sub as any).platform ?? null,
      externalUsername: sub.kick_username,
      original: { type: sub.proposed_type, message: sub.raw_message },
      final: { type: data.type, category: data.category, title: data.title, description: data.description, item_id: item.id },
    });
    return { ok: true, itemId: item.id };
  });

const rejectInput = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(280).optional(),
});

export const rejectSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rejectInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireMod(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sub, error: e0 } = await supabaseAdmin
      .from("pending_submissions").select("*").eq("id", data.id).single();
    if (e0 || !sub) throw new Error(e0?.message ?? "Sugerencia no encontrada");
    if (sub.status !== "pendiente") throw new Error("La sugerencia ya fue revisada.");

    const { error } = await supabaseAdmin.from("pending_submissions").update({
      status: "rechazado",
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: data.reason ?? null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);

    await writeAudit(ctx.userId, "submission.reject", data.id, sub, { ...sub, status: "rechazado" }, { reason: data.reason ?? null });
    await recordHistory({
      submissionId: data.id,
      moderatorId: ctx.userId,
      action: "rechazado",
      platform: (sub as any).platform ?? null,
      externalUsername: sub.kick_username,
      original: { type: sub.proposed_type, message: sub.raw_message },
      final: null,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const listModerationHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMod(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("moderation_history").select("*")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const modIds = Array.from(new Set((data ?? []).map((r: any) => r.moderator_id).filter(Boolean)));
    let map: Record<string, string> = {};
    if (modIds.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, username").in("id", modIds);
      map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]));
    }
    return (data ?? []).map((r: any) => ({ ...r, moderator_username: r.moderator_id ? map[r.moderator_id] ?? null : null }));
  });
