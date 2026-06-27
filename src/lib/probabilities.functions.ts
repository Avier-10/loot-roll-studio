import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PROBABILITIES, type CategoryConfig } from "@/config/probabilities";

const itemSchema = z.object({
  type: z.enum(["beneficio", "castigo"]),
  category: z.enum(["bueno", "muy_bueno", "excelente", "leve", "medio", "fuerte"]),
  weight: z.number().int().min(0).max(1000),
  label: z.string().min(1).max(40),
  color: z.string().min(1).max(40),
});
const configSchema = z.array(itemSchema).length(6).refine(
  (arr) => arr.reduce((s, p) => s + p.weight, 0) > 0,
  { message: "La suma de pesos debe ser mayor a 0." },
);

async function requireRoles(ctx: { supabase: any; userId: string }, allowed: string[]) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => allowed.includes(r))) {
    throw new Error(`Forbidden: required one of ${allowed.join(", ")}`);
  }
}

/** Public-ish: returns the latest probability config. Falls back to defaults. */
export const getActiveProbabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    const { data, error } = await ctx.supabase
      .from("probability_versions")
      .select("version, config, created_at, created_by, note")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return { version: 0, config: PROBABILITIES as CategoryConfig[], created_at: null, note: "Defaults" };
    }
    return {
      version: data.version as number,
      config: data.config as CategoryConfig[],
      created_at: data.created_at as string,
      note: data.note as string | null,
    };
  });

/**
 * Admin diagnostic: returns exactly what the spin algorithm resolves as the
 * active configuration. Mirrors the lookup performed in performSpin so the
 * frontend can verify the UI matches what's actually used by the server.
 */
export const verifyActiveProbabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin", "moderator"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("probability_versions")
      .select("version, config, created_at, created_by, note")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const fallback = !data;
    const config = (data?.config as CategoryConfig[]) ?? PROBABILITIES;
    let createdByUsername: string | null = null;
    if (data?.created_by) {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("username").eq("id", data.created_by).maybeSingle();
      createdByUsername = (prof?.username as string) ?? null;
    }
    return {
      version: data?.version ?? 0,
      config,
      created_at: data?.created_at ?? null,
      created_by_username: createdByUsername,
      note: data?.note ?? null,
      fallback,
      // Echo back a checksum-like signature for fast comparison
      signature: config.map((c) => `${c.category}:${c.weight}`).sort().join("|"),
    };
  });

export const listProbabilityVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin", "moderator"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("probability_versions")
      .select("id, version, config, note, restored_from_version, created_by, created_at")
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    // Join usernames
    const ids = Array.from(new Set((data ?? []).map((r) => r.created_by).filter(Boolean))) as string[];
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, username").in("id", ids);
      nameMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p.username as string]));
    }
    return (data ?? []).map((r) => ({
      ...r,
      created_by_username: r.created_by ? nameMap[r.created_by] ?? null : null,
    }));
  });

const updateInput = z.object({
  config: configSchema,
  note: z.string().trim().max(200).optional(),
});
export const updateProbabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("probability_versions").select("version, config")
      .order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = (prev?.version ?? 0) + 1;
    const { data: inserted, error } = await supabaseAdmin
      .from("probability_versions")
      .insert({
        version: nextVersion,
        config: data.config as any,
        note: data.note ?? null,
        created_by: ctx.userId,
      })
      .select("*").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("write_audit", {
      _actor: ctx.userId,
      _action: "probabilities.update",
      _target_type: "config",
      _target_table: "probability_versions",
      _target_id: inserted.id as any,
      _old: (prev?.config ?? null) as any,
      _new: data.config as any,
      _metadata: { version: nextVersion, note: data.note ?? null } as any,
    });
    return inserted;
  });

const restoreInput = z.object({ version: z.number().int().min(1) });
export const restoreProbabilityVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => restoreInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    await requireRoles(ctx, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: source, error: srcErr } = await supabaseAdmin
      .from("probability_versions").select("config, version")
      .eq("version", data.version).single();
    if (srcErr || !source) throw new Error("Versión no encontrada");
    const { data: latest } = await supabaseAdmin
      .from("probability_versions").select("version, config")
      .order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = (latest?.version ?? 0) + 1;
    const { data: inserted, error } = await supabaseAdmin
      .from("probability_versions").insert({
        version: nextVersion,
        config: source.config,
        note: `Restaurada desde v${source.version}`,
        restored_from_version: source.version,
        created_by: ctx.userId,
      }).select("*").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("write_audit", {
      _actor: ctx.userId,
      _action: "probabilities.restore",
      _target_type: "config",
      _target_table: "probability_versions",
      _target_id: inserted.id as any,
      _old: (latest?.config ?? null) as any,
      _new: source.config as any,
      _metadata: { from_version: source.version, new_version: nextVersion } as any,
    });
    return inserted;
  });
