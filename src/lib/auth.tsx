import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ViewAsProvider, useViewAs } from "@/lib/viewAs";
import { StreamModeProvider } from "@/lib/streamMode";

export type AppRole = "admin" | "streamer" | "moderator";
export type AccountStatus = "pendiente" | "activo" | "suspendido" | "deshabilitado";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];                 // real roles from DB
  effectiveRoles: AppRole[];        // affected by "Ver como"
  accountStatus: AccountStatus | null;
  username: string | null;
  displayName: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;        // uses effectiveRoles
  hasRealRole: (r: AppRole) => boolean;    // ignores "Ver como"
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function AuthInner({ children }: { children: ReactNode }) {
  const { viewAs } = useViewAs();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadIdentity = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]); setAccountStatus(null); setUsername(null); setDisplayName(null);
      return;
    }
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("account_status, username, display_name").eq("id", uid).maybeSingle(),
    ]);
    setRoles(((rolesRes.data ?? []) as { role: AppRole }[]).map((r) => r.role));
    setAccountStatus((profileRes.data?.account_status as AccountStatus | undefined) ?? null);
    setUsername((profileRes.data?.username as string | undefined) ?? null);
    setDisplayName((profileRes.data?.display_name as string | null | undefined) ?? null);
  }, []);

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
  }, [loadIdentity]);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
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

  const isAdmin = roles.includes("admin");
  const effectiveRoles: AppRole[] = (isAdmin && viewAs) ? [viewAs] : roles;
  const hasRole = (r: AppRole) => effectiveRoles.includes(r);
  const hasRealRole = (r: AppRole) => roles.includes(r);
  const refreshProfile = async () => { await loadIdentity(user?.id); };

  return (
    <Ctx.Provider value={{
      user, session, roles, effectiveRoles, accountStatus,
      username, displayName, loading,
      signIn, signOut, hasRole, hasRealRole, refreshProfile,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <ViewAsProvider>
      <StreamModeProvider>
        <AuthInner>{children}</AuthInner>
      </StreamModeProvider>
    </ViewAsProvider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
