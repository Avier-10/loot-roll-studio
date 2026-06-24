import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acceso · Lootspin" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = mode === "signin"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, username.trim() || email.split("@")[0]);
    setSubmitting(false);
    if (res.error) setError(res.error);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md surface-premium rounded-2xl p-8 glow-violet">
        <h1 className="font-display text-3xl font-bold text-center text-gold tracking-widest mb-2">
          LOOTSPIN
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Acceso restringido a usuarios autorizados
        </p>

        <div className="flex rounded-md border border-border overflow-hidden mb-6">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-2 text-xs uppercase tracking-widest font-semibold transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "signin" ? "Ingresar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <Field label="Usuario">
              <input
                value={username} onChange={(e) => setUsername(e.target.value)}
                required maxLength={50}
                className="w-full bg-input rounded-md px-3 py-2 border border-border focus:border-primary outline-none"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              autoComplete="email" maxLength={255}
              className="w-full bg-input rounded-md px-3 py-2 border border-border focus:border-primary outline-none"
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full bg-input rounded-md px-3 py-2 border border-border focus:border-primary outline-none"
            />
          </Field>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full py-3 rounded-md font-display font-bold uppercase tracking-widest bg-gradient-to-b from-[oklch(0.45_0.20_295)] to-[oklch(0.28_0.14_295)] glow-violet hover:scale-[1.01] disabled:opacity-50 transition"
          >
            {submitting ? "Procesando…" : mode === "signin" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
        <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
          La primera cuenta creada se convierte en administradora.
          Las contraseñas se almacenan cifradas. Las credenciales nunca se guardan en texto plano.
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">{label}</span>
      {children}
    </label>
  );
}
