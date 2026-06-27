import { useEffect } from "react";
import type { Item } from "@/lib/types";
import { categoryConfig } from "@/config/probabilities";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface Props { item: Item | null; open: boolean; onClose: () => void; }

export function ResultModal({ item, open, onClose }: Props) {
  useEffect(() => {
    if (!open || !item) return;
    playSound(item.type === "beneficio" ? "benefit" : "punish");
  }, [open, item]);

  if (!open || !item) return null;
  const cfg = categoryConfig(item.category);
  const isBenefit = item.type === "beneficio";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-float-up"
      role="dialog" aria-modal="true" aria-labelledby="result-title"
      onClick={onClose}
    >
      <div
        className={cn(
          // overflow-hidden ensures the decorative bar clips exactly to the rounded corners
          "surface-premium rounded-2xl w-full max-w-lg p-8 text-center animate-pop-in relative overflow-hidden",
          isBenefit ? "glow-benefit" : "glow-punish"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative bar — pinned to the top edge, full width, no extra radius */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-1.5"
          style={{ background: `var(--${cfg.color})`, boxShadow: `0 0 24px var(--${cfg.color})` }}
          aria-hidden
        />
        <div
          className="text-xs uppercase tracking-[0.3em] font-semibold mb-1"
          style={{ color: isBenefit ? "var(--benefit)" : "var(--punish)" }}
        >
          {isBenefit ? "Beneficio" : "Castigo"}
        </div>
        <div
          className="text-sm uppercase tracking-[0.25em] mb-6"
          style={{ color: `var(--${cfg.color})` }}
        >
          · {cfg.label} ·
        </div>
        <h2 id="result-title" className="font-display text-3xl sm:text-4xl font-bold mb-3 text-gold">
          {item.title}
        </h2>
        <p className="text-base text-foreground/90 mb-6 leading-relaxed">{item.description}</p>

        {item.suggested_by_username && (
          <div className="text-xs text-muted-foreground mb-6">
            Sugerido por <span className="text-foreground font-semibold">{item.suggested_by_username}</span>
            {item.suggested_at && <> · {new Date(item.suggested_at).toLocaleDateString()}</>}
          </div>
        )}

        <button
          onClick={() => { playSound("close"); onClose(); }}
          className={cn(
            "px-8 py-3 rounded-lg font-display font-bold uppercase tracking-widest transition-all",
            "bg-gradient-to-b from-[oklch(0.40_0.18_295)] to-[oklch(0.28_0.12_295)]",
            "border border-[oklch(0.65_0.20_295)] glow-violet hover:scale-105"
          )}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
