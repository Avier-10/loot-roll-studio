import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "streamer" | "moderator";
export type AccountStatus = "pendiente" | "activo" | "suspendido" | "deshabilitado";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  accountStatus: AccountStatus | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadIdentity = async (uid: string | undefined) => {
    if (!uid) { setRoles([]); setAccountStatus(null); return; }
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("account_status").eq("id", uid).maybeSingle(),
    ]);
    setRoles(((rolesRes.data ?? []) as { role: AppRole }[]).map((r) => r.role));
    setAccountStatus((profileRes.data?.account_status as AccountStatus | undefined) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        setTimeout(() => { void loadIdentity(s?.user?.id); }, 0);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      void loadIdentity(data.session?.user?.id).finally(() => setLoading(false));
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    // Validate account status on the spot
    const uid = data.user?.id;
    if (uid) {
      const { data: prof } = await supabase
        .from("profiles").select("account_status").eq("id", uid).maybeSingle();
      const status = prof?.account_status as AccountStatus | undefined;
      if (status && status !== "activo") {
        await supabase.auth.signOut();
        return { error: `Tu cuenta está ${status}. Contactá a un administrador.` };
      }
    }
    return {};
  };
  const signOut = async () => { await supabase.auth.signOut(); };
  const hasRole = (r: AppRole) => roles.includes(r);

  return (
    <Ctx.Provider value={{ user, session, roles, accountStatus, loading, signIn, signOut, hasRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
