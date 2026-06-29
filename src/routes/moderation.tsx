import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import type { ItemCategory, ItemType } from "@/lib/types";
import {
  listSubmissions,
  approveSubmission,
  rejectSubmission,
  listModerationHistory,
} from "@/lib/submissions.functions";

interface Submission {
  id: string;
  kick_username: string;
  raw_message: string;
  proposed_type: ItemType | null;
  proposed_title: string | null;
  proposed_description: string | null;
  proposed_category: ItemCategory | null;
  status: "pendiente" | "aprobado" | "rechazado";
  platform: string | null;
  created_at: string;
  rejection_reason?: string | null;
}

type TypeFilter = "todos" | "beneficio" | "castigo";

export const Route = createFileRoute("/moderation")({
  head: () => ({ meta: [{ title: "Moderación · Lootspin" }] }),
  component: ModerationPage,
});

function ModerationPage() {
  const { user, loading, hasRole } = useAuth();
  const list = useServerFn(listSubmissions);
  const history = useServerFn(listModerationHistory);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<TypeFilter>("todos");
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes");
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    if (tab === "pendientes") {
      void list({ data: { status: "pendiente", type: filter } }).then((rows) =>
        setSubs(rows as Submission[]),
      );
    } else {
      void history().then((rows) => setHistoryRows(rows));
    }
  }, [user, filter, tab, reloadKey, list, history]);

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

  const counts = useMemo(() => ({
    todos: subs.length,
    beneficio: subs.filter((s) => s.proposed_type === "beneficio").length,
    castigo: subs.filter((s) => s.proposed_type === "castigo").length,
  }), [subs]);

  return (
    <>
      <AppNav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-gold tracking-widest">MODERACIÓN</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sugerencias enviadas desde el chat (Kick, etc.). Aprueba para enviarlas al pool.
            </p>
          </div>
          <div className="flex gap-2">
            <TabBtn active={tab === "pendientes"} onClick={() => setTab("pendientes")}>Pendientes</TabBtn>
            <TabBtn active={tab === "historial"} onClick={() => setTab("historial")}>Historial</TabBtn>
          </div>
        </div>

        {tab === "pendientes" && (
          <>
            <div className="flex gap-2 flex-wrap">
              <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")}>
                Todos · {counts.todos}
              </FilterChip>
              <FilterChip active={filter === "castigo"} onClick={() => setFilter("castigo")}>
                Castigos · {counts.castigo}
              </FilterChip>
              <FilterChip active={filter === "beneficio"} onClick={() => setFilter("beneficio")}>
                Beneficios · {counts.beneficio}
              </FilterChip>
            </div>

            {subs.length === 0 ? (
              <div className="surface-premium rounded-2xl p-10 text-center text-muted-foreground">
                No hay sugerencias pendientes.
              </div>
            ) : (
              <div className="space-y-4">
                {subs.map((s) => (
                  <SubmissionCard key={s.id} s={s} onChanged={() => setReloadKey((k) => k + 1)} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "historial" && <HistoryList rows={historyRows} />}
      </main>
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-md border transition ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full border transition ${
        active ? "bg-gold/20 border-gold text-gold" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SubmissionCard({ s, onChanged }: { s: Submission; onChanged: () => void }) {
  const approve = useServerFn(approveSubmission);
  const reject = useServerFn(rejectSubmission);
  const [type, setType] = useState<ItemType>(s.proposed_type ?? "castigo");
  const [category, setCategory] = useState<ItemCategory>(
    s.proposed_category ?? (type === "beneficio" ? "bueno" : "leve"),
  );
  const [title, setTitle] = useState(s.proposed_title ?? "");
  const [description, setDescription] = useState(s.proposed_description ?? s.raw_message);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const cats = type === "beneficio"
    ? (["bueno", "muy_bueno", "excelente"] as const)
    : (["leve", "medio", "fuerte"] as const);

  async function onApprove() {
    if (!title.trim() || !description.trim()) return;
    setBusy(true);
    try {
      await approve({ data: { id: s.id, type, category, title: title.trim(), description: description.trim() } });
      onChanged();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    setBusy(true);
    try {
      await reject({ data: { id: s.id, reason: reason.trim() || undefined } });
      onChanged();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
      setRejecting(false);
    }
  }

  return (
    <div className="surface-premium rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
        <div>
          <span className="text-foreground font-semibold">{s.kick_username}</span>
          {" · "}
          <span className="uppercase tracking-wider">{s.platform ?? "kick"}</span>
          {" · "}
          {new Date(s.created_at).toLocaleString()}
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${
          s.proposed_type === "beneficio" ? "border-benefit text-benefit" : "border-destructive text-destructive"
        }`}>
          {s.proposed_type ?? "—"}
        </span>
      </div>

      <p className="text-sm italic border-l-2 border-border pl-3">"{s.raw_message}"</p>

      <div className="grid sm:grid-cols-2 gap-2">
        <select
          value={type}
          onChange={(e) => { const t = e.target.value as ItemType; setType(t); setCategory(t === "beneficio" ? "bueno" : "leve"); }}
          className="bg-input rounded-md px-3 py-2 border border-border"
        >
          <option value="beneficio">Beneficio</option>
          <option value="castigo">Castigo</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ItemCategory)}
          className="bg-input rounded-md px-3 py-2 border border-border"
        >
          {cats.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          maxLength={120}
          className="bg-input rounded-md px-3 py-2 border border-border sm:col-span-2"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción"
          maxLength={500}
          className="bg-input rounded-md px-3 py-2 border border-border sm:col-span-2 min-h-[60px]"
        />
      </div>

      {rejecting ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm">¿Confirmas rechazar esta sugerencia?</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            maxLength={280}
            className="bg-input rounded-md px-3 py-2 border border-border w-full text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setRejecting(false)} disabled={busy} className="px-4 py-2 text-sm rounded-md border border-border">
              Cancelar
            </button>
            <button onClick={confirmReject} disabled={busy} className="px-4 py-2 text-sm rounded-md bg-destructive text-background font-bold disabled:opacity-40">
              Confirmar rechazo
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-md border border-destructive text-destructive"
          >
            Rechazar
          </button>
          <button
            onClick={onApprove}
            disabled={busy || !title.trim() || !description.trim()}
            className="px-4 py-2 text-sm rounded-md bg-benefit text-background font-bold disabled:opacity-40"
          >
            Aprobar
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryList({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div className="surface-premium rounded-2xl p-10 text-center text-muted-foreground">
        Sin actividad de moderación todavía.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="surface-premium rounded-xl p-4 text-sm">
          <div className="flex justify-between flex-wrap gap-2 text-xs text-muted-foreground">
            <div>
              <span className={`uppercase font-bold tracking-wider ${r.action === "aprobado" ? "text-benefit" : "text-destructive"}`}>
                {r.action}
              </span>
              {" · por "}
              <span className="text-foreground">{r.moderator_username ?? "—"}</span>
              {" · "}
              {new Date(r.created_at).toLocaleString()}
            </div>
            <div>
              {r.external_username} <span className="uppercase">[{r.platform ?? "—"}]</span>
            </div>
          </div>
          <div className="mt-2 grid sm:grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Original</div>
              <pre className="text-xs bg-input/40 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(r.original_content, null, 2)}
              </pre>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Final</div>
              <pre className="text-xs bg-input/40 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
                {r.final_content ? JSON.stringify(r.final_content, null, 2) : "—"}
              </pre>
            </div>
          </div>
          {r.reason && <p className="mt-2 text-xs"><span className="text-muted-foreground">Motivo:</span> {r.reason}</p>}
        </div>
      ))}
    </div>
  );
}
