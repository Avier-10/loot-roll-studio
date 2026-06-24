import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acceso · Lootspin" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn(email.trim(), password);
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
          Acceso restringido. Solo los administradores pueden crear cuentas nuevas.
        </p>

        <form onSubmit={onSubmit} className="space-y-4" aria-label="Iniciar sesión">
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
              minLength={6} autoComplete="current-password"
              className="w-full bg-input rounded-md px-3 py-2 border border-border focus:border-primary outline-none"
            />
          </Field>

          {error && (
            <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full py-3 rounded-md font-display font-bold uppercase tracking-widest bg-gradient-to-b from-[oklch(0.45_0.20_295)] to-[oklch(0.28_0.14_295)] glow-violet hover:scale-[1.01] disabled:opacity-50 transition"
          >
            {submitting ? "Procesando…" : "Iniciar sesión"}
          </button>
        </form>
        <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
          ¿No tenés cuenta? Pedile a un administrador que la cree.
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
