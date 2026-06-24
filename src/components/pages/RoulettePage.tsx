import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { performSpin, getPendingSpin, acknowledgePendingSpin } from "@/lib/spin.functions";
import { Roulette, CategoryLegend } from "@/components/Roulette";
import { ResultModal } from "@/components/ResultModal";
import { AppNav } from "@/components/AppNav";
import type { Item } from "@/lib/types";

export function RoulettePage() {
  const [winner, setWinner] = useState<Item | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(false);

  const spinFn = useServerFn(performSpin);
  const getPendingFn = useServerFn(getPendingSpin);
  const ackPendingFn = useServerFn(acknowledgePendingSpin);
  const hasPendingRef = useRef(false);

  const { data: pool = [] } = useQuery<Item[]>({
    queryKey: ["items", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  // Restore pending result on mount (e.g. after navigation away)
  useEffect(() => {
    let cancelled = false;
    void getPendingFn().then((res) => {
      if (cancelled) return;
      if (res.spin) {
        setWinner(res.spin.item);
        setModalOpen(true);
        hasPendingRef.current = true;
        setPendingNotice(true);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [getPendingFn]);

  // Warn before leaving when a result is pending
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasPendingRef.current || spinning) {
        e.preventDefault();
        e.returnValue = "Tenés un resultado pendiente de visualizar.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [spinning]);

  async function handleSpin() {
    if (spinning || requesting || pool.length === 0) return;
    setError(null);
    setRequesting(true);
    setModalOpen(false);
    setWinner(null);
    try {
      const result = await spinFn();
      setWinner(result.item as Item);
      setSpinning(true);
      hasPendingRef.current = true;
      setPendingNotice(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al girar");
    } finally {
      setRequesting(false);
    }
  }

  async function handleClose() {
    setModalOpen(false);
    hasPendingRef.current = false;
    setPendingNotice(false);
    try { await ackPendingFn(); } catch {}
  }

  const buttonLabel = requesting
    ? "Solicitando…"
    : spinning
      ? "Girando…"
      : "Girar";

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

        {pendingNotice && (
          <div role="status" className="mb-4 surface-premium border border-gold/40 rounded-xl px-4 py-3 text-sm text-gold">
            Tenés un resultado pendiente de visualizar.{" "}
            <button onClick={() => setModalOpen(true)} className="underline font-semibold">
              Ver resultado
            </button>
          </div>
        )}

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
            disabled={spinning || requesting || pool.length === 0}
            aria-busy={spinning || requesting}
            className="px-12 py-4 rounded-xl font-display text-xl font-bold uppercase tracking-[0.3em] bg-gradient-to-b from-[oklch(0.86_0.18_85)] to-[oklch(0.62_0.16_75)] text-gold-foreground glow-gold disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-[0.98] transition-transform"
          >
            {buttonLabel}
          </button>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      </main>

      <ResultModal item={winner} open={modalOpen} onClose={handleClose} />
    </>
  );
}
