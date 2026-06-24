import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useStreamMode } from "@/lib/streamMode";
import { RoulettePage } from "@/components/pages/RoulettePage";

export const Route = createFileRoute("/stream")({
  head: () => ({ meta: [{ title: "Stream · Lootspin" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: StreamRoute,
});

function StreamRoute() {
  const { user, loading, hasRealRole } = useAuth();
  const { setStreamMode } = useStreamMode();
  useEffect(() => {
    setStreamMode(true);
    return () => setStreamMode(false);
  }, [setStreamMode]);

  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!hasRealRole("admin") && !hasRealRole("streamer")) {
    return <div className="p-10 text-center text-destructive">No autorizado.</div>;
  }
  return <RoulettePage stream />;
}
