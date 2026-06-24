import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { updateOwnProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Perfil · Lootspin" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading, username, displayName, refreshProfile, roles } = useAuth();
  const updateFn = useServerFn(updateOwnProfile);
  const [u, setU] = useState("");
  const [d, setD] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;

  const currentU = username ?? "";
  const currentD = displayName ?? "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOk(false); setBusy(true);
    try {
      await updateFn({ data: { username: u || currentU, display_name: d || undefined } });
      await refreshProfile();
      setOk(true);
      setU(""); setD("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <AppNav />
      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <h1 className="font-display text-3xl font-bold text-gold tracking-widest">PERFIL</h1>
        <section className="surface-premium rounded-2xl p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            <div>Email: <span className="text-foreground">{user.email}</span></div>
            <div>Roles: <span className="text-foreground">{roles.join(", ") || "—"}</span></div>
          </div>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Username</span>
              <input value={u} onChange={(e) => setU(e.target.value)} placeholder={currentU}
                minLength={2} maxLength={50}
                className="w-full bg-input rounded-md px-3 py-2 border border-border" />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Nombre visible</span>
              <input value={d} onChange={(e) => setD(e.target.value)} placeholder={currentD}
                maxLength={80}
                className="w-full bg-input rounded-md px-3 py-2 border border-border" />
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {ok && <p className="text-sm text-benefit">Perfil actualizado.</p>}
            <button disabled={busy}
              className="px-5 py-2 rounded-md bg-primary text-primary-foreground font-bold uppercase tracking-wider text-sm">
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
