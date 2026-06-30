import { createFileRoute } from "@tanstack/react-router";

type StepStatus = "ok" | "error" | "not_allowed";
type Steps = Record<string, StepStatus>;

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `debug_insert_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-lootspin-endpoint": "api-public-debug-insert",
      ...headers,
    },
  });
}

export const Route = createFileRoute("/api/public/debug-insert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const id = requestId();
        const steps: Steps = { route: "ok", method: "ok" };

        // eslint-disable-next-line no-console
        console.log(`[debug-insert ${id}] handler ejecutado`, { method: request.method, url: request.url });

        const expected = process.env.KICK_BOT_API_KEY;
        if (!expected) {
          steps.config = "error";
          return json(
            {
              success: false,
              requestId: id,
              endpoint: "/api/public/debug-insert",
              step: "config",
              error: "Server not configured",
              steps,
            },
            500,
          );
        }
        steps.config = "ok";

        const auth = request.headers.get("authorization") ?? "";
        const apiKeyHeader = request.headers.get("x-api-key") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : apiKeyHeader.trim();
        if (!token || token !== expected) {
          steps.auth = "error";
          return json(
            {
              success: false,
              requestId: id,
              endpoint: "/api/public/debug-insert",
              step: "auth",
              error: "Unauthorized",
              steps,
            },
            401,
          );
        }
        steps.auth = "ok";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          steps.databaseClient = "ok";
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
          console.log(`[debug-insert ${id}] payload`, payload);
          const { data, error } = await supabaseAdmin
            .from("pending_submissions")
            .insert(payload as any)
            .select("id, created_at")
            .single();
          if (error) {
            steps.database = "error";
            // eslint-disable-next-line no-console
            console.error(`[debug-insert ${id}] database error`, error);
            return json(
              {
                success: false,
                requestId: id,
                endpoint: "/api/public/debug-insert",
                step: "database",
                error: error.message,
                code: (error as any).code,
                hint: (error as any).hint,
                details: (error as any).details,
                steps,
              },
              500,
            );
          }
          steps.database = "ok";
          const body = {
            success: true,
            requestId: id,
            endpoint: "/api/public/debug-insert",
            steps,
            database: "ok",
            inserted: data,
            payload,
          };

          // eslint-disable-next-line no-console
          console.log(`[debug-insert ${id}] response`, { success: true, insertedId: data?.id ?? null });

          return json(body, 201);
        } catch (e: any) {
          steps.databaseClient = "error";
          // eslint-disable-next-line no-console
          console.error(`[debug-insert ${id}] thrown`, e);
          return json(
            {
              success: false,
              requestId: id,
              endpoint: "/api/public/debug-insert",
              step: "exception",
              error: e?.message ?? "unknown",
              steps,
            },
            500,
          );
        }
      },
      GET: async () => {
        const id = requestId();
        return json({
          success: false,
          requestId: id,
          endpoint: "/api/public/debug-insert",
          step: "method",
          error: "Method Not Allowed",
          allowed: ["POST"],
          steps: { route: "ok", method: "not_allowed" },
        }, 405, { allow: "POST" });
      },
    },
  },
});
