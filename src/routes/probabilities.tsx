import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import {
  listProbabilityVersions, updateProbabilities, restoreProbabilityVersion,
  verifyActiveProbabilities,
} from "@/lib/probabilities.functions";

export const Route = createFileRoute("/probabilities")({
  head: () => ({ meta: [{ title: "Probabilidades · Lootspin" }] }),
  component: ProbsPage,
});

type CategoryConfig = {
  type: "beneficio" | "castigo";
  category: "bueno" | "muy_bueno" | "excelente" | "leve" | "medio" | "fuerte";
  weight: number;
  label: string;
  color: string;
};

type Version = {
  id: string;
  version: number;
  config: CategoryConfig[];
  note: string | null;
  restored_from_version: number | null;
  created_by: string | null;
  created_by_username: string | null;
  created_at: string;
};

const CATEGORIES: Array<{ type: "beneficio" | "castigo"; category: CategoryConfig["category"]; label: string; color: string }> = [
  { type: "beneficio", category: "bueno", label: "Bueno", color: "cat-bueno" },
  { type: "beneficio", category: "muy_bueno", label: "Muy Bueno", color: "cat-muy-bueno" },
  { type: "beneficio", category: "excelente", label: "Excelente", color: "cat-excelente" },
  { type: "castigo", category: "leve", label: "Leve", color: "cat-leve" },
  { type: "castigo", category: "medio", label: "Medio", color: "cat-medio" },
  { type: "castigo", category: "fuerte", label: "Fuerte", color: "cat-fuerte" },
];

function ProbsPage() {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!hasRole("admin") && !hasRole("moderator")) {
    return (<><AppNav /><div className="p-10 text-center text-destructive">No autorizado.</div></>);
  }
  return (
    <>
      <AppNav />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <h1 className="font-display text-3xl font-bold text-gold tracking-widest">PROBABILIDADES</h1>
        <ProbsContent />
      </main>
    </>
  );
}

function ProbsContent() {
  const { hasRole } = useAuth();
  const listFn = useServerFn(listProbabilityVersions);
  const updateFn = useServerFn(updateProbabilities);
  const restoreFn = useServerFn(restoreProbabilityVersion);

  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  const canEdit = hasRole("admin");

  async function load() {
    setBusy(true); setError(null);
    try {
      const res = (await listFn()) as Version[];
      setVersions(res);
      const latest = res[0];
      if (latest) {
        const map: Record<string, number> = {};
        latest.config.forEach((c) => { map[c.category] = c.weight; });
        setDraft(map);
        setCompareA(latest.version);
        setCompareB(res[1]?.version ?? latest.version);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!canEdit) return;
    setError(null);
    const config: CategoryConfig[] = CATEGORIES.map((c) => ({
      ...c, weight: Math.max(0, Math.floor(draft[c.category] ?? 0)),
    }));
    const total = config.reduce((s, c) => s + c.weight, 0);
    if (total <= 0) { setError("La suma de pesos debe ser mayor a 0."); return; }
    try {
      await updateFn({ data: { config, note: note.trim() || undefined } });
      setNote("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function restore(version: number) {
    if (!canEdit) return;
    if (!confirm(`¿Restaurar la versión ${version}? Se creará una nueva versión con esa configuración.`)) return;
    try { await restoreFn({ data: { version } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  const latest = versions[0];
  const total = CATEGORIES.reduce((s, c) => s + (draft[c.category] ?? 0), 0) || 1;

  const verA = versions.find((v) => v.version === compareA);
  const verB = versions.find((v) => v.version === compareB);

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <section className="surface-premium rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">Configuración actual</h2>
          {latest && (
            <span className="text-xs text-muted-foreground">
              v{latest.version} · {new Date(latest.created_at).toLocaleString()}
              {latest.created_by_username && <> · por {latest.created_by_username}</>}
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <ColumnEditor title="Beneficios" rows={CATEGORIES.filter((c) => c.type === "beneficio")}
            draft={draft} setDraft={setDraft} total={total} disabled={!canEdit} />
          <ColumnEditor title="Castigos" rows={CATEGORIES.filter((c) => c.type === "castigo")}
            draft={draft} setDraft={setDraft} total={total} disabled={!canEdit} />
        </div>
        {canEdit && (
          <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <label className="flex-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Nota (opcional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
                placeholder="Ej. Aumentar excelente al 10%"
                className="w-full bg-input rounded-md px-3 py-2 border border-border" />
            </label>
            <button onClick={save} disabled={busy}
              className="px-5 py-2 rounded-md bg-primary text-primary-foreground font-bold uppercase tracking-wider text-sm">
              Guardar como nueva versión
            </button>
          </div>
        )}
      </section>

      <section className="surface-premium rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-xl font-bold">Comparar versiones</h2>
        <p className="text-xs text-muted-foreground">
          "Cambio" = porcentaje en la versión <span className="text-foreground">A</span> menos el porcentaje en la versión <span className="text-foreground">B</span>.
        </p>
        <div className="flex gap-3 items-center flex-wrap text-sm">
          <VersionSelect label="A (más reciente)" value={compareA} setValue={setCompareA} versions={versions} />
          <VersionSelect label="B (referencia)" value={compareB} setValue={setCompareB} versions={versions} />
        </div>
        {verA && verB && <CompareTable a={verA} b={verB} />}
        {verA && verB && <VersionMetaPanel a={verA} b={verB} />}
      </section>

      {hasRole("admin") && <DiagnosticPanel latest={latest} />}

      <section className="surface-premium rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4">Historial</h2>
        <div className="space-y-2">
          {versions.map((v) => {
            const sum = v.config.reduce((s, c) => s + c.weight, 0) || 1;
            return (
              <div key={v.id} className="border border-border rounded-md p-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-gold">v{v.version}</span>
                <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                <span className="text-xs">por <span className="text-foreground">{v.created_by_username ?? "sistema"}</span></span>
                {v.restored_from_version && (
                  <span className="text-[10px] text-gold uppercase tracking-wider">restaurada de v{v.restored_from_version}</span>
                )}
                {v.note && <span className="text-xs italic text-muted-foreground truncate max-w-[300px]">"{v.note}"</span>}
                <div className="ml-auto flex gap-1 flex-wrap">
                  {v.config.map((c) => (
                    <span key={c.category} className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-border"
                      style={{ color: `var(--${c.color})` }}>
                      {c.label} {Math.round((c.weight / sum) * 100)}%
                    </span>
                  ))}
                </div>
                {canEdit && versions[0]?.id !== v.id && (
                  <button onClick={() => restore(v.version)}
                    className="text-xs px-3 py-1 rounded border border-gold text-gold">Restaurar</button>
                )}
              </div>
            );
          })}
          {versions.length === 0 && !busy && <p className="text-sm text-center text-muted-foreground py-4">Sin versiones todavía.</p>}
        </div>
      </section>
    </div>
  );
}

function ColumnEditor({
  title, rows, draft, setDraft, total, disabled,
}: {
  title: string;
  rows: typeof CATEGORIES;
  draft: Record<string, number>;
  setDraft: (d: Record<string, number>) => void;
  total: number;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {rows.map((c) => {
        const w = draft[c.category] ?? 0;
        const pct = ((w / total) * 100).toFixed(1);
        return (
          <div key={c.category} className="flex items-center gap-3 border border-border rounded-md p-2">
            <span className="w-24 text-xs uppercase tracking-wider" style={{ color: `var(--${c.color})` }}>
              {c.label}
            </span>
            <input type="number" min={0} max={1000} value={w} disabled={disabled}
              onChange={(e) => setDraft({ ...draft, [c.category]: Number(e.target.value) })}
              className="w-20 bg-input rounded-md px-2 py-1 border border-border text-sm" />
            <span className="text-xs text-muted-foreground w-16 text-right">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function VersionSelect({
  label, value, setValue, versions,
}: { label: string; value: number | null; setValue: (n: number | null) => void; versions: Version[] }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value ?? ""} onChange={(e) => setValue(Number(e.target.value) || null)}
        className="bg-input rounded-md px-2 py-1 border border-border text-sm">
        {versions.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}
      </select>
    </label>
  );
}

function CompareTable({ a, b }: { a: Version; b: Version }) {
  const sumA = a.config.reduce((s, c) => s + c.weight, 0) || 1;
  const sumB = b.config.reduce((s, c) => s + c.weight, 0) || 1;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wider text-muted-foreground">
          <th className="text-left py-1">Categoría</th>
          <th className="text-right py-1">v{a.version}</th>
          <th className="text-right py-1">v{b.version}</th>
          <th className="text-right py-1">Cambio</th>
        </tr>
      </thead>
      <tbody>
        {a.config.map((ca) => {
          const cb = b.config.find((c) => c.category === ca.category)!;
          const pa = (ca.weight / sumA) * 100;
          const pb = (cb.weight / sumB) * 100;
          // Cambio = A (más reciente / actual) - B (referencia / anterior).
          // Incremento => positivo (verde); reducción => negativo (rojo).
          const delta = pa - pb;
          const rounded = Math.round(delta * 10) / 10;
          const color = rounded > 0 ? "text-benefit" : rounded < 0 ? "text-punish" : "text-muted-foreground";
          return (
            <tr key={ca.category} className="border-t border-border">
              <td className="py-1 text-xs uppercase" style={{ color: `var(--${ca.color})` }}>{ca.label}</td>
              <td className="py-1 text-right">{pa.toFixed(1)}%</td>
              <td className="py-1 text-right">{pb.toFixed(1)}%</td>
              <td className={`py-1 text-right font-semibold ${color}`}>
                {rounded > 0 ? "+" : ""}{rounded.toFixed(1)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function VersionMetaPanel({ a, b }: { a: Version; b: Version }) {
  const changed = a.config.filter((ca) => {
    const cb = b.config.find((c) => c.category === ca.category);
    return cb ? cb.weight !== ca.weight : true;
  });
  return (
    <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs">
      {[a, b].map((v, idx) => (
        <div key={v.id} className="border border-border rounded-md p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gold">v{v.version}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {idx === 0 ? "A · más reciente" : "B · referencia"}
            </span>
          </div>
          <div className="text-muted-foreground">
            <span className="text-foreground">Fecha:</span> {new Date(v.created_at).toLocaleString()}
          </div>
          <div className="text-muted-foreground">
            <span className="text-foreground">Autor:</span> {v.created_by_username ?? "sistema"}
          </div>
          {v.restored_from_version && (
            <div className="text-gold">↻ Restaurada de v{v.restored_from_version}</div>
          )}
          <div className="text-muted-foreground">
            <span className="text-foreground">Motivo:</span> {v.note ? <em>"{v.note}"</em> : <span className="opacity-60">— sin motivo —</span>}
          </div>
        </div>
      ))}
      <div className="sm:col-span-2 border border-border rounded-md p-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Categorías modificadas entre B y A
        </div>
        {changed.length === 0 ? (
          <p className="text-muted-foreground">No hay cambios de pesos entre estas dos versiones.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {changed.map((c) => {
              const prev = b.config.find((x) => x.category === c.category);
              return (
                <li key={c.category} className="px-2 py-1 rounded border border-border"
                  style={{ color: `var(--${c.color})` }}>
                  {c.label}: <span className="text-muted-foreground">{prev?.weight ?? 0}</span>
                  {" → "}
                  <span className="text-foreground">{c.weight}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DiagnosticPanel({ latest }: { latest: Version | undefined }) {
  const verifyFn = useServerFn(verifyActiveProbabilities);
  const [server, setServer] = useState<Awaited<ReturnType<typeof verifyActiveProbabilities>> | null>(null);
  const [status, setStatus] = useState<"idle" | "ok" | "mismatch" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (!latest) return;
    setBusy(true);
    try {
      const res = await verifyFn();
      setServer(res);
      const uiSig = latest.config
        .map((c) => `${c.category}:${c.weight}`).sort().join("|");
      if (res.fallback) {
        setStatus("mismatch");
        setMessage("El servidor no encontró ninguna versión en la base de datos y está usando los valores por defecto del archivo de configuración. Guardá una versión para sincronizar.");
      } else if (res.signature !== uiSig || res.version !== latest.version) {
        setStatus("mismatch");
        setMessage(`La UI muestra v${latest.version} pero el servidor está resolviendo v${res.version}. Recargá la página para sincronizar.`);
      } else {
        setStatus("ok");
        setMessage(`UI, base de datos y algoritmo del servidor coinciden en v${res.version}.`);
      }
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Error desconocido");
    } finally { setBusy(false); }
  }

  const badge =
    status === "ok" ? "border-benefit text-benefit"
    : status === "mismatch" ? "border-punish text-punish"
    : status === "error" ? "border-destructive text-destructive"
    : "border-border text-muted-foreground";

  return (
    <section className="surface-premium rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Diagnóstico</h2>
          <p className="text-xs text-muted-foreground">
            Verifica que la UI, la base de datos y el algoritmo del servidor compartan la misma configuración activa.
          </p>
        </div>
        <button onClick={verify} disabled={busy || !latest}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-bold uppercase tracking-wider text-xs">
          {busy ? "Verificando…" : "Verificar configuración"}
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <div className="border border-border rounded-md p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">UI (Historial)</div>
          {latest ? (
            <>
              <div>v{latest.version}</div>
              <div className="text-muted-foreground">{new Date(latest.created_at).toLocaleString()}</div>
              <div className="text-muted-foreground">por {latest.created_by_username ?? "sistema"}</div>
            </>
          ) : <span className="text-muted-foreground">—</span>}
        </div>
        <div className="border border-border rounded-md p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Servidor (algoritmo de spin)</div>
          {server ? (
            <>
              <div>v{server.version} {server.fallback && <span className="text-punish">(fallback)</span>}</div>
              <div className="text-muted-foreground">
                {server.created_at ? new Date(server.created_at).toLocaleString() : "—"}
              </div>
              <div className="text-muted-foreground">por {server.created_by_username ?? "sistema"}</div>
            </>
          ) : <span className="text-muted-foreground">Pulsá "Verificar"</span>}
        </div>
        <div className={`border rounded-md p-3 ${badge}`}>
          <div className="text-[10px] uppercase tracking-widest mb-1 opacity-80">Resultado</div>
          <div className="font-semibold">
            {status === "idle" && "Sin verificar"}
            {status === "ok" && "✓ Sincronizado"}
            {status === "mismatch" && "⚠ Discrepancia"}
            {status === "error" && "✕ Error"}
          </div>
          {message && <div className="text-[11px] mt-1 opacity-90">{message}</div>}
        </div>
      </div>

      {server && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Ver configuración resuelta por el servidor</summary>
          <pre className="mt-2 p-3 rounded bg-input border border-border overflow-auto">
{JSON.stringify(server.config, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}
