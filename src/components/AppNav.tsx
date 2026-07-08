import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth";
import { useViewAs } from "@/lib/viewAs";
import { useStreamMode } from "@/lib/streamMode";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  moderator: "Moderador",
  streamer: "Streamer",
};

export function AppNav() {
  const { user, hasRole, hasRealRole, signOut, username, displayName, roles } = useAuth();
  const { viewAs, setViewAs } = useViewAs();
  const { setStreamMode } = useStreamMode();
  const navigate = useNavigate();
  if (!user) return null;

  const tabs = [
    { to: "/", label: "Ruleta", show: hasRole("streamer") || hasRole("admin") },
    { to: "/moderation", label: "Moderación", show: hasRole("moderator") || hasRole("admin") },
    { to: "/history", label: "Historial", show: hasRole("streamer") || hasRole("admin") },
    { to: "/audit", label: "Auditoría", show: hasRole("admin") || hasRole("moderator") },
    { to: "/admin", label: "Admin", show: hasRole("admin") },
    { to: "/probabilities", label: "Probabilidades", show: hasRole("admin") || hasRole("moderator") },
    { to: "/users", label: "Usuarios", show: hasRole("admin") },
    { to: "/trash", label: "Papelera", show: hasRole("admin") },
  ];

  const displayedRole = (viewAs ?? (roles.includes("admin") ? "admin" : roles[0])) as AppRole | undefined;
  const isAdmin = hasRealRole("admin");
  const primaryName = displayName || username || "Usuario";

  return (
    <header data-stream-hide className="sticky top-0 z-30 backdrop-blur bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link to="/" className="font-display text-xl font-bold text-gold tracking-widest">
          LOOTSPINnn
        </Link>
        <nav className="flex items-center gap-1 flex-wrap">
          {tabs.filter((t) => t.show).map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: true }}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-semibold uppercase tracking-wider",
                "text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              )}
              activeProps={{ className: "text-gold bg-accent/60" }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <label className="hidden md:flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Ver como</span>
              <select
                value={viewAs ?? ""}
                onChange={(e) => setViewAs((e.target.value || null) as AppRole | null)}
                className="bg-input rounded border border-border px-1.5 py-0.5 text-xs text-foreground"
                aria-label="Ver como rol"
              >
                <option value="">Real</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderador</option>
                <option value="streamer">Streamer</option>
              </select>
            </label>
          )}
          {(hasRealRole("admin") || hasRealRole("streamer")) && (
            <button
              onClick={() => { setStreamMode(true); void navigate({ to: "/stream" }); }}
              className="text-[11px] px-2 py-1 rounded border border-[var(--brand-glow)] text-[var(--brand-glow)] hover:bg-[var(--brand-deep)]/40 transition uppercase tracking-wider"
              title="Modo OBS sin chrome"
            >
              Stream Mode
            </button>
          )}
          <Link
            to="/profile"
            className="text-right leading-tight hover:opacity-80 transition"
            title="Editar perfil"
          >
            <div className="text-sm font-semibold text-foreground">{primaryName}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {displayedRole ? ROLE_LABEL[displayedRole] : "—"}
              {viewAs && isAdmin && <span className="ml-1 text-gold">(vista)</span>}
            </div>
          </Link>
          <button
            onClick={() => void signOut()}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-destructive hover:text-destructive transition"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
