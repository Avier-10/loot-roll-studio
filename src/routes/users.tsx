import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, type AppRole, type AccountStatus } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import {
  listUsers, createUser, setUserRoles, setUserStatus, updateUserProfile,
} from "@/lib/users.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Usuarios · Lootspin" }] }),
  component: UsersPage,
});

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  account_status: AccountStatus;
  roles: AppRole[];
  created_at: string;
};

const ROLES: AppRole[] = ["admin", "streamer", "moderator"];
const STATUSES: AccountStatus[] = ["activo", "pendiente", "suspendido", "deshabilitado"];

function UsersPage() {
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
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <h1 className="font-display text-3xl font-bold text-gold tracking-widest">USUARIOS</h1>
        <Manager />
      </main>
    </>
  );
}

function Manager() {
  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const rolesFn = useServerFn(setUserRoles);
  const statusFn = useServerFn(setUserStatus);
  const profileFn = useServerFn(updateUserProfile);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", username: "", display_name: "", role: "streamer" as AppRole });

  async function load() {
    setBusy(true);
    try {
      const res = await listFn();
      setUsers(res as UserRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createFn({ data: form });
      setForm({ email: "", password: "", username: "", display_name: "", role: "streamer" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function toggleRole(u: UserRow, role: AppRole) {
    const next = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    if (next.length === 0) { setError("El usuario debe tener al menos un rol."); return; }
    try {
      await rolesFn({ data: { user_id: u.id, roles: next } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function changeStatus(u: UserRow, status: AccountStatus) {
    try {
      await statusFn({ data: { user_id: u.id, status } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function rename(u: UserRow) {
    const username = prompt("Nuevo username:", u.username);
    if (!username || username === u.username) return;
    try {
      await profileFn({ data: { user_id: u.id, username } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <section className="space-y-8">
      <form onSubmit={onCreate} className="surface-premium rounded-2xl p-6 grid sm:grid-cols-2 gap-3">
        <h2 className="sm:col-span-2 font-display text-xl font-bold">Crear usuario</h2>
        <input required type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="bg-input rounded-md px-3 py-2 border border-border" />
        <input required minLength={8} type="password" placeholder="Contraseña (mín 8)" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="bg-input rounded-md px-3 py-2 border border-border" />
        <input required minLength={2} maxLength={50} placeholder="Username" value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="bg-input rounded-md px-3 py-2 border border-border" />
        <input maxLength={80} placeholder="Nombre visible (opcional)" value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          className="bg-input rounded-md px-3 py-2 border border-border" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
          className="bg-input rounded-md px-3 py-2 border border-border">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="sm:col-span-2 px-5 py-2 rounded-md bg-primary text-primary-foreground font-bold uppercase tracking-wider text-sm">
          Crear
        </button>
        {error && <p role="alert" className="sm:col-span-2 text-destructive text-sm">{error}</p>}
      </form>

      <div className="surface-premium rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">Listado ({users.length})</h2>
          <button onClick={() => void load()} disabled={busy}
            className="text-xs px-3 py-1 rounded-md border border-border">
            {busy ? "Cargando…" : "Refrescar"}
          </button>
        </div>
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="border border-border rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {u.username}
                  <span className="text-xs text-muted-foreground ml-2">{u.email}</span>
                </div>
                <div className="text-xs text-muted-foreground">{u.display_name}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {ROLES.map((r) => (
                  <button key={r} onClick={() => toggleRole(u, r)}
                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${u.roles.includes(r) ? "border-gold text-gold" : "border-border text-muted-foreground"}`}>
                    {r}
                  </button>
                ))}
              </div>
              <select value={u.account_status} onChange={(e) => changeStatus(u, e.target.value as AccountStatus)}
                className="bg-input rounded-md px-2 py-1 border border-border text-xs">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => rename(u)} className="text-xs px-2 py-1 rounded border border-border">
                Renombrar
              </button>
            </div>
          ))}
          {users.length === 0 && !busy && (
            <p className="text-center text-sm text-muted-foreground py-4">Sin usuarios.</p>
          )}
        </div>
      </div>
    </section>
  );
}
