import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { listTrash, restoreItem, hardDeleteItem } from "@/lib/items.functions";
import type { Item } from "@/lib/types";

export const Route = createFileRoute("/trash")({
  head: () => ({ meta: [{ title: "Papelera · Lootspin" }] }),
  component: TrashPage,
});

function TrashPage() {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!hasRole("admin")) return (
    <><AppNav /><div className="p-10 text-center text-destructive">No autorizado.</div></>
  );
  return (
    <>
      <AppNav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold text-gold tracking-widest">PAPELERA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Elementos eliminados. Restaurá para devolverlos al pool o eliminá definitivamente (requiere confirmación).
          </p>
        </header>
        <TrashList />
      </main>
    </>
  );
}

function TrashList() {
  const listFn = useServerFn(listTrash);
  const restoreFn = useServerFn(restoreItem);
  const hardFn = useServerFn(hardDeleteItem);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true); setError(null);
    try { setItems((await listFn()) as Item[]); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  async function onRestore(id: string) {
    try { await restoreFn({ data: { id } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }
  async function onHardDelete(id: string, title: string) {
    const v = prompt(`Eliminar definitivamente "${title}".\nEscribí ELIMINAR para confirmar:`);
    if (v !== "ELIMINAR") return;
    try { await hardFn({ data: { id, confirm: "ELIMINAR" } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <section className="surface-premium rounded-2xl p-4 space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {busy && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!busy && items.length === 0 && (
        <p className="text-center text-muted-foreground py-6 text-sm">La papelera está vacía.</p>
      )}
      {items.map((it) => (
        <div key={it.id} className="flex flex-wrap items-center gap-3 border border-border rounded-md p-3">
          <span className={`text-xs px-2 py-0.5 rounded ${it.type === "beneficio" ? "bg-benefit/20 text-benefit" : "bg-punish/20 text-punish"}`}>
            {it.type}
          </span>
          <span className="text-xs text-muted-foreground uppercase">{it.category.replace("_", " ")}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{it.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{it.description}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Eliminado: {it.deleted_at ? new Date(it.deleted_at).toLocaleString() : "—"}
            </div>
          </div>
          <button onClick={() => onRestore(it.id)}
            className="text-xs px-3 py-1 rounded border border-benefit text-benefit">Restaurar</button>
          <button onClick={() => onHardDelete(it.id, it.title)}
            className="text-xs px-3 py-1 rounded border border-destructive text-destructive">Eliminar definitivamente</button>
        </div>
      ))}
    </section>
  );
}
