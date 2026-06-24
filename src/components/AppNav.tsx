import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function AppNav() {
  const { user, hasRole, signOut } = useAuth();
  if (!user) return null;
  const tabs = [
    { to: "/", label: "Ruleta", show: hasRole("streamer") || hasRole("admin") },
    { to: "/moderation", label: "Moderación", show: hasRole("moderator") || hasRole("admin") },
    { to: "/history", label: "Historial", show: hasRole("streamer") || hasRole("admin") },
    { to: "/admin", label: "Admin", show: hasRole("admin") },
    { to: "/admin/users", label: "Usuarios", show: hasRole("admin") },
  ];

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link to="/" className="font-display text-xl font-bold text-gold tracking-widest">
          LOOTSPIN
        </Link>
        <nav className="flex items-center gap-1">
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
          <span className="text-xs text-muted-foreground hidden sm:block">{user.email}</span>
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
