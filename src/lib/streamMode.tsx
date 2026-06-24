import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY = "lootspin.stream_mode";

interface Ctx {
  streamMode: boolean;
  setStreamMode: (v: boolean) => void;
}
const StreamCtx = createContext<Ctx>({ streamMode: false, setStreamMode: () => {} });

export function StreamModeProvider({ children }: { children: ReactNode }) {
  const [streamMode, setState] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") setState(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("stream-mode", streamMode);
  }, [streamMode]);
  function setStreamMode(v: boolean) {
    setState(v);
    try {
      if (v) localStorage.setItem(KEY, "1");
      else localStorage.removeItem(KEY);
    } catch {}
  }
  return <StreamCtx.Provider value={{ streamMode, setStreamMode }}>{children}</StreamCtx.Provider>;
}

export function useStreamMode() {
  return useContext(StreamCtx);
}
