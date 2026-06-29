import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const submissionSchema = z.object({
  type: z.enum(["castigo", "beneficio"]),
  user: z.string().trim().min(1).max(60),
  message: z.string().trim().min(3).max(280),
  platform: z.string().trim().min(1).max(40).default("kick"),
});

function sanitize(s: string) {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isDebug() {
  return String(process.env.DEBUG_PUBLIC_API ?? "").toLowerCase() === "true";
}

function rid() {
  return (globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
}

function dbg(requestId: string, stage: string, payload?: unknown) {
  if (!isDebug()) return;
  // eslint-disable-next-line no-console
  console.log(`[submissions ${requestId}] ${stage}`, payload === undefined ? "" : payload);
}

export const Route = createFileRoute("/api/public/submissions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const debug = isDebug();
        const requestId = rid();
        const startedAt = new Date().toISOString();
        const steps: Record<string, string> = {};

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;

        if (debug) {
          const headerDump: Record<string, string> = {};
          request.headers.forEach((v, k) => {
            if (k.toLowerCase() === "authorization" || k.toLowerCase() === "x-api-key") {
              headerDump[k] = v ? `***len:${v.length}` : "";
            } else {
              headerDump[k] = v;
            }
          });
          dbg(requestId, "REQUEST RECEIVED", {
            timestamp: startedAt,
            requestId,
            ip,
            method: request.method,
            url: request.url,
            headers: headerDump,
          });
        }

        const fail = (step: string, status: number, error: string, details?: unknown) => {
          dbg(requestId, `FAIL @ ${step}`, { status, error, details });
          return json(
            debug
              ? { success: false, requestId, step, error, details: details ?? null, steps }
              : { success: false, error },
            status,
          );
        };

        // 1. API KEY
        const expected = process.env.KICK_BOT_API_KEY;
        if (!expected) return fail("config", 500, "Server not configured (missing KICK_BOT_API_KEY)");
        const auth = request.headers.get("authorization") ?? "";
        const apiKeyHeader = request.headers.get("x-api-key") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : apiKeyHeader.trim();
        if (!token || token !== expected) {
          steps.apiKey = "error";
          return fail("apiKey", 401, "API Key incorrecta");
        }
        steps.apiKey = "ok";
        dbg(requestId, "API KEY VALIDATION", "OK");

        // 2. BODY
        let payload: unknown;
        try {
          payload = await request.json();
        } catch (e: any) {
          return fail("body", 400, "Invalid JSON", e?.message ?? null);
        }
        dbg(requestId, "BODY RECEIVED", payload);

        // 3. VALIDATION
        const parsed = submissionSchema.safeParse(payload);
        if (!parsed.success) {
          steps.validation = "error";
          return fail("validation", 400, "Solicitud inválida", parsed.error.flatten());
        }
        const user = sanitize(parsed.data.user);
        const message = sanitize(parsed.data.message);
        const platform = sanitize(parsed.data.platform).toLowerCase();
        const proposedType = parsed.data.type === "castigo" ? "castigo" : "beneficio";

        dbg(requestId, "BODY AFTER SANITIZATION", { user, message, platform, proposedType });
        steps.sanitize = "ok";

        if (!user || !message) {
          steps.validation = "error";
          return fail("validation", 400, "Contenido vacío tras sanitización");
        }
        if (message.length < 3) {
          steps.validation = "error";
          return fail("validation", 400, "Mensaje demasiado corto");
        }
        steps.validation = "ok";

        // 4. DB
        let supabaseAdmin: any;
        try {
          ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
        } catch (e: any) {
          return fail("database", 500, "No se pudo cargar el cliente Supabase", e?.message ?? null);
        }

        // 5. RATE LIMIT
        const sixtyAgo = new Date(Date.now() - 60_000).toISOString();
        const { count: recentCount, error: rateErr } = await supabaseAdmin
          .from("pending_submissions")
          .select("id", { count: "exact", head: true })
          .eq("kick_username", user)
          .gte("created_at", sixtyAgo);
        if (rateErr) {
          steps.rateLimit = "error";
          return fail("rateLimit", 500, "Error consultando rate limit", rateErr);
        }
        dbg(requestId, "RATE LIMIT", { recentCount });
        if ((recentCount ?? 0) >= 5) {
          steps.rateLimit = "blocked";
          return fail("rateLimit", 429, "Rate limit excedido (5/min)");
        }
        steps.rateLimit = "ok";

        // 6. DEDUPE
        const tenAgo = new Date(Date.now() - 10 * 60_000).toISOString();
        const { data: dup, error: dupErr } = await supabaseAdmin
          .from("pending_submissions")
          .select("id")
          .eq("kick_username", user)
          .eq("raw_message", message)
          .gte("created_at", tenAgo)
          .limit(1)
          .maybeSingle();
        if (dupErr) {
          steps.dedupe = "error";
          return fail("dedupe", 500, "Error consultando duplicados", dupErr);
        }
        dbg(requestId, "DEDUPE", { duplicate: !!dup, id: dup?.id ?? null });
        if (dup) {
          steps.dedupe = "duplicate";
          return json(
            debug
              ? { success: false, requestId, step: "dedupe", error: "Duplicado detectado", duplicateId: dup.id, steps }
              : { success: false, error: "Duplicado detectado", duplicateId: dup.id },
            409,
          );
        }
        steps.dedupe = "ok";

        // 7. INSERT
        const insertPayload = {
          kick_username: user,
          raw_message: message,
          proposed_type: proposedType as any,
          platform,
          ip_address: ip,
          status: "pendiente",
        };
        dbg(requestId, "INSERT DATABASE", insertPayload);
        const { data, error } = await supabaseAdmin
          .from("pending_submissions")
          .insert(insertPayload as any)
          .select("id")
          .single();

        if (error) {
          steps.database = "error";
          dbg(requestId, "INSERT FAILED", {
            table: "pending_submissions",
            message: error.message,
            code: (error as any).code,
            hint: (error as any).hint,
            details: (error as any).details,
          });
          return fail("database", 500, "Error al insertar en la base de datos", {
            message: error.message,
            code: (error as any).code,
            hint: (error as any).hint,
            details: (error as any).details,
          });
        }
        steps.database = "ok";

        const responseBody = debug
          ? {
              success: true,
              requestId,
              received: { type: proposedType, user, message, platform },
              steps,
              submissionId: data.id,
            }
          : { success: true, id: data.id };

        dbg(requestId, "RESPONSE", { status: 201, body: responseBody });
        return json(responseBody, 201);
      },
    },
  },
});
