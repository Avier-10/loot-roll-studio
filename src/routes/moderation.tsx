import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import type { ItemCategory, ItemType } from "@/lib/types";

interface Submission {
  id: string;
  kick_username: string;
  raw_message: string;
  proposed_type: ItemType | null;
  proposed_title: string | null;
  proposed_description: string | null;
  proposed_category: ItemCategory | null;
  status: "pendiente" | "aprobado" | "rechazado";
  created_at: string;
}

export const Route = createFileRoute("/moderation")({
  head: () => ({ meta: [{ title: "Moderación · Lootspin" }] }),
  component: ModerationPage,
});

function ModerationPage() {
  const { user, loading, hasRole } = useAuth();
  const [subs, setSubs] = useState<Submission[]>([]);

  useEffect(() => {
    if (!user) return;
    void supabase.from("pending_submissions").select("*").eq("status", "pendiente").order("created_at").then(({ data }) =>
      setSubs((data ?? []) as Submission[])
    );
  }, [user]);

  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!hasRole("moderator") && !hasRole("admin")) {
    return (
      <>
        <AppNav />
        <div className="p-10 text-center text-destructive">No autorizado.</div>
      </>
    );
  }

  async function approve(s: Submission, type: ItemType, category: ItemCategory, title: string, description: string) {
    if (!user) return;
    const { data: item, error: e1 } = await supabase.from("items").insert({
      type, category, title, description,
      suggested_by_username: s.kick_username,
      suggested_at: s.created_at,
      created_by: user.id,
    }).select("id").single();
    if (e1) { alert(e1.message); return; }
    const { error: e2 } = await supabase.from("pending_submissions").update({
      status: "aprobado", reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      approved_item_id: item.id, proposed_type: type, proposed_category: category,
      proposed_title: title, proposed_description: description,
    }).eq("id", s.id);
    if (e2) { alert(e2.message); return; }
    setSubs((cur) => cur.filter((x) => x.id !== s.id));
  }

  async function reject(s: Submission) {
    if (!user) return;
    await supabase.from("pending_submissions").update({
      status: "rechazado", reviewed_by: user.id, reviewed_at: new Date().toISOString()
    }).eq("id", s.id);
    setSubs((cur) => cur.filter((x) => x.id !== s.id));
  }

  return (
    <>
      <AppNav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-gold tracking-widest mb-6">MODERACIÓN</h1>
        {subs.length === 0 && (
          <div className="surface-premium rounded-2xl p-10 text-center text-muted-foreground">
            No hay sugerencias pendientes.
          </div>
        )}
        <div className="space-y-4">
          {subs.map((s) => <SubmissionCard key={s.id} s={s} onApprove={approve} onReject={reject} />)}
        </div>
      </main>
    </>
  );
}

function SubmissionCard({ s, onApprove, onReject }: {
  s: Submission;
  onApprove: (s: Submission, t: ItemType, c: ItemCategory, title: string, desc: string) => void;
  onReject: (s: Submission) => void;
}) {
  const [type, setType] = useState<ItemType>(s.proposed_type ?? "castigo");
  const [category, setCategory] = useState<ItemCategory>(s.proposed_category ?? (type === "beneficio" ? "bueno" : "leve"));
  const [title, setTitle] = useState(s.proposed_title ?? "");
  const [description, setDescription] = useState(s.proposed_description ?? s.raw_message);

  const cats = type === "beneficio"
    ? (["bueno", "muy_bueno", "excelente"] as const)
    : (["leve", "medio", "fuerte"] as const);

  return (
    <div className="surface-premium rounded-xl p-4">
      <div className="text-xs text-muted-foreground mb-3">
        <span className="text-foreground font-semibold">{s.kick_username}</span> · {new Date(s.created_at).toLocaleString()}
      </div>
      <p className="text-sm italic mb-4 border-l-2 border-border pl-3">"{s.raw_message}"</p>
      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        <select value={type} onChange={(e) => { const t = e.target.value as ItemType; setType(t); setCategory(t === "beneficio" ? "bueno" : "leve"); }}
          className="bg-input rounded-md px-3 py-2 border border-border">
          <option value="beneficio">Beneficio</option>
          <option value="castigo">Castigo</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)}
          className="bg-input rounded-md px-3 py-2 border border-border">
          {cats.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título"
          className="bg-input rounded-md px-3 py-2 border border-border sm:col-span-2" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción"
          className="bg-input rounded-md px-3 py-2 border border-border sm:col-span-2 min-h-[60px]" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => onReject(s)} className="px-4 py-2 text-sm rounded-md border border-destructive text-destructive">Rechazar</button>
        <button onClick={() => onApprove(s, type, category, title.trim(), description.trim())}
          disabled={!title.trim() || !description.trim()}
          className="px-4 py-2 text-sm rounded-md bg-benefit text-background font-bold disabled:opacity-40">
          Aprobar
        </button>
      </div>
    </div>
  );
}
