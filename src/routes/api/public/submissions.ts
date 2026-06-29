import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const submissionSchema = z.object({
  type: z.enum(["castigo", "beneficio"]),
  user: z.string().trim().min(1).max(60),
  message: z.string().trim().min(3).max(280),
  platform: z.string().trim().min(1).max(40).default("kick"),
});

// Strip HTML tags / control chars / script-like content
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

export const Route = createFileRoute("/api/public/submissions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.KICK_BOT_API_KEY;
        if (!expected) return json({ error: "Server not configured" }, 500);

        const auth = request.headers.get("authorization") ?? "";
        const apiKeyHeader = request.headers.get("x-api-key") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : apiKeyHeader.trim();
        if (!token || token !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const parsed = submissionSchema.safeParse(payload);
        if (!parsed.success) {
          return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
        }

        const user = sanitize(parsed.data.user);
        const message = sanitize(parsed.data.message);
        const platform = sanitize(parsed.data.platform).toLowerCase();
        const proposedType = parsed.data.type === "castigo" ? "castigo" : "beneficio";

        if (!user || !message) return json({ error: "Empty content" }, 400);
        if (message.length < 3) return json({ error: "Message too short" }, 400);

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Rate limit: max 5 submissions per user (any platform) in the last 60s
        const sixtyAgo = new Date(Date.now() - 60_000).toISOString();
        const { count: recentCount } = await supabaseAdmin
          .from("pending_submissions")
          .select("id", { count: "exact", head: true })
          .eq("kick_username", user)
          .gte("created_at", sixtyAgo);
        if ((recentCount ?? 0) >= 5) {
          return json({ error: "Rate limit exceeded" }, 429);
        }

        // Duplicate guard: same user + same message in last 10 minutes
        const tenAgo = new Date(Date.now() - 10 * 60_000).toISOString();
        const { data: dup } = await supabaseAdmin
          .from("pending_submissions")
          .select("id")
          .eq("kick_username", user)
          .eq("raw_message", message)
          .gte("created_at", tenAgo)
          .limit(1)
          .maybeSingle();
        if (dup) return json({ ok: true, deduplicated: true, id: dup.id });

        const { data, error } = await supabaseAdmin
          .from("pending_submissions")
          .insert({
            kick_username: user,
            raw_message: message,
            proposed_type: proposedType as any,
            platform,
            ip_address: ip,
            status: "pendiente",
          } as any)
          .select("id")
          .single();

        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, id: data.id }, 201);
      },
    },
  },
});
