import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { listAudit } from "@/lib/audit.functions";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Auditoría · Lootspin" }] }),
  component: AuditPage,
});

type Row = {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  action: string;
  target_type: string | null;
  target_table: string | null;
  target_id: string | null;
  old_value: unknown;
  new_value: unknown;
  metadata: unknown;
  created_at: string;
};

const TARGET_TYPES = ["item", "user", "spin", "submission", "config"];

function AuditPage() {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!hasRole("admin") && !hasRole("moderator")) return (
    <><AppNav /><div className="p-10 text-center text-destructive">No autorizado.</div></>
  );
  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <h1 className="font-display text-3xl font-bold text-gold tracking-widest">AUDITORÍA</h1>
        <AuditTable />
      </main>
    </>
  );
}

function AuditTable() {
  const listFn = useServerFn(listAudit);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"created_at.desc" | "created_at.asc">("created_at.desc");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setBusy(true); setError(null);
    try {
      const res = await listFn({
        data: {
          page, pageSize,
          action: action || undefined,
          targetType: targetType || undefined,
          search: search || undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          sort,
        },
      });
      setRows(res.rows as Row[]);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [page, sort]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  return (
    <section className="space-y-4">
      <div className="surface-premium rounded-2xl p-4 grid sm:grid-cols-6 gap-2">
        <input placeholder="Acción (ej. item.create)" value={action} onChange={(e) => setAction(e.target.value)}
          className="bg-input rounded-md px-3 py-2 border border-border text-sm sm:col-span-2" />
        <select value={targetType} onChange={(e) => setTargetType(e.target.value)}
          className="bg-input rounded-md px-3 py-2 border border-border text-sm">
          <option value="">Toda entidad</option>
          {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="bg-input rounded-md px-3 py-2 border border-border text-sm" />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="bg-input rounded-md px-3 py-2 border border-border text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="bg-input rounded-md px-3 py-2 border border-border text-sm" />
        <div className="sm:col-span-6 flex gap-2 justify-end">
          <button onClick={() => { setPage(1); void load(); }} disabled={busy}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wider">
            {busy ? "Cargando…" : "Aplicar filtros"}
          </button>
          <button onClick={() => { setAction(""); setTargetType(""); setSearch(""); setFrom(""); setTo(""); setPage(1); void load(); }}
            className="px-4 py-2 rounded-md border border-border text-sm">Limpiar</button>
          <button onClick={() => setSort(sort === "created_at.desc" ? "created_at.asc" : "created_at.desc")}
            className="px-4 py-2 rounded-md border border-border text-sm">
            Orden: {sort === "created_at.desc" ? "↓ recientes" : "↑ antiguos"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="surface-premium rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Entidad</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RowItem key={r.id} row={r} expanded={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
            ))}
            {rows.length === 0 && !busy && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Sin registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{total} registros · página {page} / {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="px-3 py-1 rounded-md border border-border disabled:opacity-40">Anterior</button>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="px-3 py-1 rounded-md border border-border disabled:opacity-40">Siguiente</button>
        </div>
      </div>
    </section>
  );
}

function RowItem({ row, expanded, onToggle }: { row: Row; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-t border-border hover:bg-accent/20">
        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleString()}
        </td>
        <td className="px-3 py-2 text-xs">{row.actor_username ?? "—"}</td>
        <td className="px-3 py-2"><code className="text-gold text-xs">{row.action}</code></td>
        <td className="px-3 py-2 text-xs">{row.target_type ?? "—"}</td>
        <td className="px-3 py-2 text-[10px] text-muted-foreground truncate max-w-[160px]">{row.target_id ?? "—"}</td>
        <td className="px-3 py-2 text-right">
          <button onClick={onToggle} className="text-xs px-2 py-1 rounded border border-border">
            {expanded ? "Ocultar" : "Detalles"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-background/40">
          <td colSpan={6} className="px-3 py-3">
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <Pre title="Valor anterior" value={row.old_value} />
              <Pre title="Valor nuevo" value={row.new_value} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Pre({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <pre className="bg-muted/40 rounded-md p-2 overflow-auto max-h-40 text-[11px]">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
