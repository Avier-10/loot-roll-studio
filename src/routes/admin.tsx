import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { PROBABILITIES } from "@/config/probabilities";
import type { Item, ItemCategory, ItemType } from "@/lib/types";
import { z } from "zod";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Lootspin" }] }),
  component: AdminPage,
});

const itemSchema = z.object({
  type: z.enum(["beneficio", "castigo"]),
  category: z.enum(["bueno", "muy_bueno", "excelente", "leve", "medio", "fuerte"]),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
});

function AdminPage() {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!hasRole("admin")) return (
    <>
      <AppNav />
      <div className="p-10 text-center text-destructive">No autorizado.</div>
    </>
  );
  return (
    <>
      <AppNav />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        <h1 className="font-display text-3xl font-bold text-gold tracking-widest">PANEL DE ADMIN</h1>
        <ProbabilitiesPanel />
        <ItemsManager />
      </main>
    </>
  );
}

function ProbabilitiesPanel() {
  const total = PROBABILITIES.reduce((s, p) => s + p.weight, 0);
  return (
    <section className="surface-premium rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold mb-4">Probabilidades</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Editar en <code className="text-gold">src/config/probabilities.ts</code>.
        Estas se aplican en el servidor.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PROBABILITIES.map((p) => (
          <div key={p.category} className="rounded-md border border-border p-3 text-center">
            <div className="text-xs uppercase tracking-widest font-bold" style={{ color: `var(--${p.color})` }}>
              {p.type} · {p.label}
            </div>
            <div className="text-2xl font-display mt-1">{((p.weight / total) * 100).toFixed(0)}%</div>
            <div className="text-[10px] text-muted-foreground">peso: {p.weight}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ItemsManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"all" | ItemType>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ type: "beneficio" as ItemType, category: "bueno" as ItemCategory, title: "", description: "" });
  const [editing, setEditing] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Item[]);
  }
  useEffect(() => { void load(); }, []);

  const filtered = items.filter((i) =>
    (filter === "all" || i.type === filter) &&
    (search === "" || i.title.toLowerCase().includes(search.toLowerCase()))
  );

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = itemSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
    if (editing) {
      const { error: err } = await supabase.from("items").update(parsed.data).eq("id", editing.id);
      if (err) { setError(err.message); return; }
      setEditing(null);
    } else {
      const { error: err } = await supabase.from("items").insert({ ...parsed.data, created_by: user?.id });
      if (err) { setError(err.message); return; }
    }
    setForm({ type: "beneficio", category: "bueno", title: "", description: "" });
    void load();
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este elemento?")) return;
    await supabase.from("items").delete().eq("id", id);
    void load();
  }
  async function toggleActive(it: Item) {
    await supabase.from("items").update({ is_active: !it.is_active }).eq("id", it.id);
    void load();
  }
  function startEdit(it: Item) {
    setEditing(it);
    setForm({ type: it.type, category: it.category, title: it.title, description: it.description });
  }

  const availableCats = form.type === "beneficio"
    ? (["bueno", "muy_bueno", "excelente"] as const)
    : (["leve", "medio", "fuerte"] as const);

  return (
    <section className="surface-premium rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold mb-4">Gestión de contenido</h2>

      <form onSubmit={onSave} className="grid sm:grid-cols-2 gap-3 mb-6">
        <select
          className="bg-input rounded-md px-3 py-2 border border-border"
          value={form.type}
          onChange={(e) => {
            const t = e.target.value as ItemType;
            setForm({ ...form, type: t, category: t === "beneficio" ? "bueno" : "leve" });
          }}
        >
          <option value="beneficio">Beneficio</option>
          <option value="castigo">Castigo</option>
        </select>
        <select
          className="bg-input rounded-md px-3 py-2 border border-border"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as ItemCategory })}
        >
          {availableCats.map((c) => (
            <option key={c} value={c}>{c.replace("_", " ")}</option>
          ))}
        </select>
        <input
          placeholder="Título"
          className="bg-input rounded-md px-3 py-2 border border-border sm:col-span-2"
          value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          placeholder="Descripción"
          className="bg-input rounded-md px-3 py-2 border border-border sm:col-span-2 min-h-[80px]"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        {error && <p className="text-destructive text-sm sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2 flex gap-2">
          <button className="px-5 py-2 rounded-md bg-primary text-primary-foreground font-bold uppercase tracking-wider text-sm">
            {editing ? "Actualizar" : "Crear"}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm({ type: "beneficio", category: "bueno", title: "", description: "" }); }}
              className="px-5 py-2 rounded-md border border-border text-sm">Cancelar</button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap gap-2 mb-3">
        {(["all", "beneficio", "castigo"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-md text-xs uppercase tracking-wider border ${filter === f ? "border-gold text-gold" : "border-border text-muted-foreground"}`}>
            {f}
          </button>
        ))}
        <input
          placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-input rounded-md px-3 py-1 border border-border text-sm"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((it) => (
          <div key={it.id} className="flex items-center gap-3 border border-border rounded-md p-3">
            <span className={`text-xs px-2 py-0.5 rounded ${it.type === "beneficio" ? "bg-benefit/20 text-benefit" : "bg-punish/20 text-punish"}`}>
              {it.type}
            </span>
            <span className="text-xs text-muted-foreground uppercase">{it.category.replace("_", " ")}</span>
            <div className="flex-1">
              <div className="font-semibold">{it.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{it.description}</div>
            </div>
            <button onClick={() => toggleActive(it)} className={`text-xs px-2 py-1 rounded border ${it.is_active ? "border-benefit text-benefit" : "border-muted text-muted-foreground"}`}>
              {it.is_active ? "Activo" : "Inactivo"}
            </button>
            <button onClick={() => startEdit(it)} className="text-xs px-2 py-1 rounded border border-border">Editar</button>
            <button onClick={() => onDelete(it.id)} className="text-xs px-2 py-1 rounded border border-destructive text-destructive">Eliminar</button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Sin elementos.</p>}
      </div>
    </section>
  );
}
