import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type AppRole = "admin" | "streamer" | "moderator";
type AccountStatus = "pendiente" | "activo" | "suspendido" | "deshabilitado";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: rolesRows } = await ctx.supabase
    .from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin")) throw new Error("Forbidden: admin only");
}

const roleSchema = z.enum(["admin", "streamer", "moderator"]);
const statusSchema = z.enum(["pendiente", "activo", "suspendido", "deshabilitado"]);

async function audit(
  actor: string,
  action: string,
  targetType: string,
  targetTable: string,
  targetId: string | null,
  oldValue: unknown,
  newValue: unknown,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.rpc("write_audit", {
    _actor: actor, _action: action, _target_type: targetType,
    _target_table: targetTable, _target_id: targetId as any,
    _old: (oldValue ?? null) as any, _new: (newValue ?? null) as any, _metadata: {} as any,
  });
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, account_status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles").select("user_id, role").in("user_id", ids);
    const rolesByUser = new Map<string, AppRole[]>();
    (roleRows ?? []).forEach((r) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as AppRole);
      rolesByUser.set(r.user_id, list);
    });
    // Pull emails from auth
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailById = new Map<string, string>();
    usersList?.users.forEach((u) => { if (u.email) emailById.set(u.id, u.email); });
    return (profiles ?? []).map((p) => ({
      id: p.id as string,
      username: p.username as string,
      display_name: p.display_name as string | null,
      email: emailById.get(p.id) ?? null,
      account_status: p.account_status as AccountStatus,
      roles: rolesByUser.get(p.id) ?? [],
      created_at: p.created_at as string,
    }));
  });

const createUserInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  username: z.string().trim().min(2).max(50),
  display_name: z.string().trim().max(80).optional(),
  role: roleSchema,
});
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, display_name: data.display_name ?? data.username },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    if (data.role !== "streamer") {
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    }
    await audit((context as any).userId, "user.create", "user", "auth.users", uid, null, {
      email: data.email, username: data.username, role: data.role,
    });
    return { id: uid };
  });

const updateRoleInput = z.object({
  user_id: z.string().uuid(),
  roles: z.array(roleSchema).min(1).max(3),
});
export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (data.user_id === (context as any).userId && !data.roles.includes("admin")) {
      throw new Error("No podés removerte el rol admin a vos mismo.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").insert(
      data.roles.map((r) => ({ user_id: data.user_id, role: r }))
    );
    await audit((context as any).userId, "user.roles_change", "user", "user_roles", data.user_id,
      (prev ?? []).map((p) => p.role), data.roles);
    return { ok: true };
  });

const statusInput = z.object({
  user_id: z.string().uuid(),
  status: statusSchema,
});
export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (data.user_id === (context as any).userId && data.status !== "activo") {
      throw new Error("No podés desactivar tu propia cuenta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("profiles").select("account_status").eq("id", data.user_id).single();
    const { error } = await supabaseAdmin
      .from("profiles").update({ account_status: data.status }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    const action = data.status === "suspendido" ? "user.suspend"
      : data.status === "activo" ? "user.activate"
      : data.status === "deshabilitado" ? "user.disable"
      : "user.status_change";
    await audit((context as any).userId, action, "user", "profiles", data.user_id,
      { account_status: prev?.account_status }, { account_status: data.status });
    return { ok: true };
  });

const editInput = z.object({
  user_id: z.string().uuid(),
  username: z.string().trim().min(2).max(50).optional(),
  display_name: z.string().trim().max(80).optional(),
});
export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => editInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { username?: string; display_name?: string | null } = {};
    if (data.username) patch.username = data.username;
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { data: prev } = await supabaseAdmin
      .from("profiles").select("username, display_name").eq("id", data.user_id).single();
    const { data: after, error } = await supabaseAdmin
      .from("profiles").update(patch).eq("id", data.user_id).select("username, display_name").single();
    if (error) throw new Error(error.message);
    await audit((context as any).userId, "user.profile_update", "user", "profiles", data.user_id, prev, after);
    return { ok: true };
  });
