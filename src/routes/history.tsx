import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { softDeleteSpin, clearAllSpins } from "@/lib/history.functions";
import type { Item } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Historial · Lootspin" }] }),
  component: HistoryPage,
});

interface SpinRow { id: string; created_at: string; item_snapshot: Item; }

function HistoryPage() {
  const { user, loading, hasRole } = useAuth();
  const [rows, setRows] = useState<SpinRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clearStage, setClearStage] = useState<0 | 1 | 2>(0);
  const [clearConfirm, setClearConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const softDeleteFn = useServerFn(softDeleteSpin);
  const clearAllFn = useServerFn(clearAllSpins);

  async function load() {
    const { data, error } = await supabase
      .from("spins").select("id, created_at, item_snapshot")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(200);
    if (error) { setError(error.message); return; }
    setRows(((data ?? []) as unknown) as SpinRow[]);
  }
  useEffect(() => { if (user) void load(); }, [user]);

  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!hasRole("streamer") && !hasRole("admin")) {
    return (<><AppNav /><div className="p-10 text-center text-destructive">No autorizado.</div></>);
  }

  const isAdmin = hasRole("admin");

  async function deleteOne(id: string) {
    if (!confirm("¿Eliminar esta tirada del historial? Podés revertirlo desde auditoría.")) return;
    setError(null);
    try { await softDeleteFn({ data: { id } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }
  async function clearAll() {
    if (clearConfirm !== "BORRAR HISTORIAL") { setError("Texto de confirmación incorrecto."); return; }
    setBusy(true); setError(null);
    try {
      await clearAllFn({ data: { confirm: "BORRAR HISTORIAL" } });
      setClearStage(0); setClearConfirm("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <AppNav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-bold text-gold tracking-widest">HISTORIAL</h1>
          {isAdmin && rows.length > 0 && (
            <button onClick={() => setClearStage(1)}
              className="text-xs px-3 py-1.5 rounded border border-destructive text-destructive hover:bg-destructive/10">
              Vaciar historial
            </button>
          )}
        </div>

        {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}

        {clearStage > 0 && (
          <div className="surface-premium border border-destructive/60 rounded-xl p-4 mb-4 space-y-3">
            {clearStage === 1 ? (
              <>
                <p className="text-sm">
                  ¿Estás seguro de vaciar el historial? Esta acción puede revertirse desde auditoría
                  (soft delete) pero ocultará todas las tiradas para todos.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setClearStage(2)} className="text-xs px-3 py-1.5 rounded border border-destructive text-destructive">
                    Sí, continuar
                  </button>
                  <button onClick={() => setClearStage(0)} className="text-xs px-3 py-1.5 rounded border border-border">
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm">
                  Para confirmar, escribí <code className="text-gold">BORRAR HISTORIAL</code>:
                </p>
                <input value={clearConfirm} onChange={(e) => setClearConfirm(e.target.value)}
                  className="bg-input rounded-md px-3 py-2 border border-border w-full sm:w-72" autoFocus />
                <div className="flex gap-2">
                  <button onClick={clearAll} disabled={busy || clearConfirm !== "BORRAR HISTORIAL"}
                    className="text-xs px-3 py-1.5 rounded border border-destructive text-destructive disabled:opacity-40">
                    {busy ? "Procesando…" : "Confirmar borrado"}
                  </button>
                  <button onClick={() => { setClearStage(0); setClearConfirm(""); }}
                    className="text-xs px-3 py-1.5 rounded border border-border">Cancelar</button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="surface-premium rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-xs uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Resultado</th>
                {isAdmin && <th className="px-4 py-3"></th>}
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
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteOne(r.id)} aria-label="Eliminar entrada"
                        className="p-1.5 rounded hover:bg-destructive/15 text-destructive">
                        <TrashIcon />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">Sin tiradas todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
    </svg>
  );
}
