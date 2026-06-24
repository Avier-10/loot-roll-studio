import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { RoulettePage } from "@/components/pages/RoulettePage";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground animate-shimmer">Cargando…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  return <RoulettePage />;
}
