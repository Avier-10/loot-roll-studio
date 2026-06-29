import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/debug-insert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.KICK_BOT_API_KEY;
        if (!expected) return json({ success: false, error: "Server not configured" }, 500);
        const auth = request.headers.get("authorization") ?? "";
        const apiKeyHeader = request.headers.get("x-api-key") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : apiKeyHeader.trim();
        if (!token || token !== expected) {
          return json({ success: false, error: "Unauthorized" }, 401);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const stamp = new Date().toISOString();
          const payload = {
            kick_username: "debug_bot",
            raw_message: `debug insert @ ${stamp}`,
            proposed_type: "beneficio" as any,
            platform: "debug",
            ip_address: null,
            status: "pendiente",
          };
          // eslint-disable-next-line no-console
          console.log("[debug-insert] payload", payload);
          const { data, error } = await supabaseAdmin
            .from("pending_submissions")
            .insert(payload as any)
            .select("id, created_at")
            .single();
          if (error) {
            // eslint-disable-next-line no-console
            console.error("[debug-insert] supabase error", error);
            return json(
              {
                success: false,
                step: "database",
                error: error.message,
                code: (error as any).code,
                hint: (error as any).hint,
                details: (error as any).details,
              },
              500,
            );
          }
          return json({ success: true, inserted: data, payload }, 201);
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.error("[debug-insert] thrown", e);
          return json({ success: false, error: e?.message ?? "unknown" }, 500);
        }
      },
    },
  },
});
