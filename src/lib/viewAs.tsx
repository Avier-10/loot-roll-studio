import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppRole } from "@/lib/auth";

const KEY = "lootspin.view_as";

interface Ctx {
  viewAs: AppRole | null;
  setViewAs: (r: AppRole | null) => void;
}
const ViewAsCtx = createContext<Ctx>({ viewAs: null, setViewAs: () => {} });

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAs, setState] = useState<AppRole | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "admin" || v === "streamer" || v === "moderator") setState(v);
    } catch {}
  }, []);
  function setViewAs(r: AppRole | null) {
    setState(r);
    try {
      if (r) localStorage.setItem(KEY, r);
      else localStorage.removeItem(KEY);
    } catch {}
  }
  return <ViewAsCtx.Provider value={{ viewAs, setViewAs }}>{children}</ViewAsCtx.Provider>;
}

export function useViewAs() {
  return useContext(ViewAsCtx);
}
