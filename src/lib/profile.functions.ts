import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({
  username: z.string().trim().min(2).max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Caracteres inválidos"),
  display_name: z.string().trim().max(80).optional(),
});
export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("profiles").select("username, display_name").eq("id", ctx.userId).single();
    const { data: after, error } = await supabaseAdmin
      .from("profiles")
      .update({ username: data.username, display_name: data.display_name ?? null })
      .eq("id", ctx.userId).select("username, display_name").single();
    if (error) {
      if (/duplicate key/i.test(error.message)) throw new Error("Ese username ya existe.");
      throw new Error(error.message);
    }
    await supabaseAdmin.rpc("write_audit", {
      _actor: ctx.userId,
      _action: "profile.self_update",
      _target_type: "user",
      _target_table: "profiles",
      _target_id: ctx.userId as any,
      _old: before as any,
      _new: after as any,
      _metadata: {} as any,
    });
    return after;
  });
