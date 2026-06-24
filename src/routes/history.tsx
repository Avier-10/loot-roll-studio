import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import type { Item } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Historial · Lootspin" }] }),
  component: HistoryPage,
});

interface SpinRow { id: string; created_at: string; item_snapshot: Item; }

function HistoryPage() {
  const { user, loading, hasRole } = useAuth();
  const [rows, setRows] = useState<SpinRow[]>([]);

  useEffect(() => {
    if (!user) return;
    void supabase.from("spins").select("id, created_at, item_snapshot").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setRows((data ?? []) as SpinRow[]));
  }, [user]);

  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!hasRole("streamer") && !hasRole("admin")) {
    return (<><AppNav /><div className="p-10 text-center text-destructive">No autorizado.</div></>);
  }

  return (
    <>
      <AppNav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-gold tracking-widest mb-6">HISTORIAL</h1>
        <div className="surface-premium rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-xs uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={r.item_snapshot.type === "beneficio" ? "text-benefit" : "text-punish"}>
                      {r.item_snapshot.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 uppercase text-xs tracking-widest">{r.item_snapshot.category.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-semibold">{r.item_snapshot.title}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Sin tiradas todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
