import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authorize(request: Request) {
  const expected = process.env.KICK_BOT_API_KEY;
  if (!expected) return { ok: false as const, status: 500, error: "Server not configured" };
  const auth = request.headers.get("authorization") ?? "";
  const apiKeyHeader = request.headers.get("x-api-key") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : apiKeyHeader.trim();
  if (!token || token !== expected) return { ok: false as const, status: 401, error: "Unauthorized" };
  return { ok: true as const };
}

export const Route = createFileRoute("/api/public/debug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = authorize(request);
        if (!auth.ok) return json({ success: false, error: auth.error }, auth.status);

        const env = {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_PUBLISHABLE_KEY: !!process.env.SUPABASE_PUBLISHABLE_KEY,
          KICK_BOT_API_KEY: !!process.env.KICK_BOT_API_KEY,
          DEBUG_PUBLIC_API: String(process.env.DEBUG_PUBLIC_API ?? ""),
        };

        let supabaseStatus: "ok" | "error" = "ok";
        let supabaseError: string | null = null;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("pending_submissions")
            .select("id", { count: "exact", head: true });
          if (error) {
            supabaseStatus = "error";
            supabaseError = error.message;
          }
        } catch (e: any) {
          supabaseStatus = "error";
          supabaseError = e?.message ?? "unknown";
        }

        const now = new Date();
        return json({
          success: true,
          message: "Backend funcionando",
          endpoint: "operativo",
          supabase: { status: supabaseStatus, error: supabaseError },
          env,
          environment: process.env.NODE_ENV ?? "unknown",
          version: process.env.npm_package_version ?? "dev",
          date: now.toISOString().slice(0, 10),
          time: now.toISOString().slice(11, 19),
          timestamp: now.toISOString(),
        });
      },
    },
  },
});
