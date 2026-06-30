import { createFileRoute } from "@tanstack/react-router";

type StepStatus = "ok" | "error" | "skipped" | "not_allowed";
type Steps = Record<string, StepStatus>;

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `debug_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-lootspin-endpoint": "api-public-debug",
      ...headers,
    },
  });
}

function authorize(request: Request, steps: Steps) {
  const expected = process.env.KICK_BOT_API_KEY;
  if (!expected) {
    steps.config = "error";
    return { ok: false as const, status: 500, step: "config", error: "Server not configured" };
  }
  steps.config = "ok";

  const auth = request.headers.get("authorization") ?? "";
  const apiKeyHeader = request.headers.get("x-api-key") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : apiKeyHeader.trim();

  if (!token || token !== expected) {
    steps.auth = "error";
    return { ok: false as const, status: 401, step: "auth", error: "Unauthorized" };
  }

  steps.auth = "ok";
  return { ok: true as const };
}

export const Route = createFileRoute("/api/public/debug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = requestId();
        const steps: Steps = { route: "ok" };
        const startedAt = new Date();

        // eslint-disable-next-line no-console
        console.log(`[debug ${id}] handler ejecutado`, { method: request.method, url: request.url });

        const auth = authorize(request, steps);
        if (!auth.ok) {
          return json(
            {
              success: false,
              requestId: id,
              endpoint: "/api/public/debug",
              step: auth.step,
              error: auth.error,
              steps,
            },
            auth.status,
          );
        }

        const env = {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_PUBLISHABLE_KEY: !!process.env.SUPABASE_PUBLISHABLE_KEY,
          KICK_BOT_API_KEY: !!process.env.KICK_BOT_API_KEY,
          DEBUG_PUBLIC_API: String(process.env.DEBUG_PUBLIC_API ?? ""),
        };
        steps.environment = "ok";

        let database: "ok" | "error" = "ok";
        let databaseError: string | null = null;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("pending_submissions")
            .select("id", { count: "exact", head: true });
          if (error) {
            database = "error";
            databaseError = error.message;
            steps.database = "error";
          } else {
            steps.database = "ok";
          }
        } catch (e: any) {
          database = "error";
          databaseError = e?.message ?? "unknown";
          steps.database = "error";
        }

        const now = new Date();
        const body = {
          success: true,
          requestId: id,
          endpoint: "/api/public/debug",
          message: "Backend funcionando",
          steps,
          database,
          databaseError,
          env,
          environment: process.env.NODE_ENV ?? "unknown",
          version: process.env.npm_package_version ?? "dev",
          startedAt: startedAt.toISOString(),
          date: now.toISOString().slice(0, 10),
          time: now.toISOString().slice(11, 19),
          timestamp: now.toISOString(),
        };

        // eslint-disable-next-line no-console
        console.log(`[debug ${id}] response`, { success: body.success, database: body.database });

        return json(body);
      },
      POST: async () => {
        const id = requestId();
        return json({
          success: false,
          requestId: id,
          endpoint: "/api/public/debug",
          step: "method",
          error: "Method Not Allowed",
          allowed: ["GET"],
          steps: { route: "ok", method: "not_allowed" },
        }, 405, { allow: "GET" });
      },
    },
  },
});
