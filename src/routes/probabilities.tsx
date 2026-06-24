import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import {
  listProbabilityVersions, updateProbabilities, restoreProbabilityVersion,
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
        <div className="flex gap-3 items-center flex-wrap text-sm">
          <VersionSelect label="A" value={compareA} setValue={setCompareA} versions={versions} />
          <VersionSelect label="B" value={compareB} setValue={setCompareB} versions={versions} />
        </div>
        {verA && verB && <CompareTable a={verA} b={verB} />}
      </section>

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
          <th className="text-right py-1">Δ</th>
        </tr>
      </thead>
      <tbody>
        {a.config.map((ca) => {
          const cb = b.config.find((c) => c.category === ca.category)!;
          const pa = (ca.weight / sumA) * 100;
          const pb = (cb.weight / sumB) * 100;
          const delta = pb - pa;
          return (
            <tr key={ca.category} className="border-t border-border">
              <td className="py-1 text-xs uppercase" style={{ color: `var(--${ca.color})` }}>{ca.label}</td>
              <td className="py-1 text-right">{pa.toFixed(1)}%</td>
              <td className="py-1 text-right">{pb.toFixed(1)}%</td>
              <td className={`py-1 text-right ${delta > 0 ? "text-benefit" : delta < 0 ? "text-punish" : "text-muted-foreground"}`}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
