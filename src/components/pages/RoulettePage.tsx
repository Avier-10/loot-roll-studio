import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { performSpin } from "@/lib/spin.functions";
import { Roulette, CategoryLegend } from "@/components/Roulette";
import { ResultModal } from "@/components/ResultModal";
import { AppNav } from "@/components/AppNav";
import type { Item } from "@/lib/types";

export function RoulettePage() {
  const [winner, setWinner] = useState<Item | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spinFn = useServerFn(performSpin);

  const { data: pool = [] } = useQuery<Item[]>({
    queryKey: ["items", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  async function handleSpin() {
    if (spinning || pool.length === 0) return;
    setError(null);
    setModalOpen(false);
    setWinner(null);
    try {
      const result = await spinFn();
      setWinner(result.item as Item);
      setSpinning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al girar");
    }
  }

  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-gold tracking-widest">
            RULETA EN VIVO
          </h1>
          <p className="text-muted-foreground mt-2 text-sm uppercase tracking-[0.3em]">
            Beneficios · Castigos · Sin piedad
          </p>
        </header>

        {pool.length === 0 ? (
          <div className="surface-premium rounded-2xl p-10 text-center text-muted-foreground">
            No hay elementos en el pool. Crea contenido desde el panel de administración.
          </div>
        ) : (
          <Roulette
            pool={pool}
            winner={winner}
            spinning={spinning}
            onSpinComplete={() => { setSpinning(false); setModalOpen(true); }}
          />
        )}

        <CategoryLegend />

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={handleSpin}
            disabled={spinning || pool.length === 0}
            className="px-12 py-4 rounded-xl font-display text-xl font-bold uppercase tracking-[0.3em] bg-gradient-to-b from-[oklch(0.86_0.18_85)] to-[oklch(0.62_0.16_75)] text-gold-foreground glow-gold disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-[0.98] transition-transform"
          >
            {spinning ? "Girando…" : "Girar"}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </main>

      <ResultModal item={winner} open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
