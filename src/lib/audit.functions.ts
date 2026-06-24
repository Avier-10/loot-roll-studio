import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const filterSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
  actorId: z.string().uuid().optional(),
  action: z.string().trim().max(80).optional(),
  targetType: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(["created_at.desc", "created_at.asc"]).default("created_at.desc"),
});

export const listAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    // Auth gate
    const { data: rolesRows } = await ctx.supabase
      .from("user_roles").select("role").eq("user_id", ctx.userId);
    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("moderator")) {
      throw new Error("Forbidden: admin or moderator required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("audit_logs")
      .select("*", { count: "exact" });

    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.targetType) q = q.eq("target_type", data.targetType);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.search) q = q.or(`action.ilike.%${data.search}%,target_type.ilike.%${data.search}%`);

    const [col, dir] = data.sort.split(".") as [string, "asc" | "desc"];
    q = q.order(col, { ascending: dir === "asc" });

    const offset = (data.page - 1) * data.pageSize;
    q = q.range(offset, offset + data.pageSize - 1);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    // Join actor usernames
    const actorIds = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))) as string[];
    let actorMap: Record<string, string> = {};
    if (actorIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, username").in("id", actorIds);
      actorMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p.username as string]));
    }

    return {
      rows: (rows ?? []).map((r) => ({ ...r, actor_username: r.actor_id ? actorMap[r.actor_id] ?? null : null })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });
