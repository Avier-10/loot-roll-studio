import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { categoryConfig, PROBABILITIES } from "@/config/probabilities";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface Props {
  pool: Item[];                  // pool of items used to fill the strip visually
  winner: Item | null;           // selected item (decided by server) when a spin runs
  spinning: boolean;
  onSpinComplete: () => void;
}

const CARD_W = 168;   // px
const CARD_GAP = 12;  // px
const STEP = CARD_W + CARD_GAP;
const STRIP_LEN = 80; // total cards rendered (more than enough for several full traversals)
const WINNER_INDEX = 60; // where in the strip we place the winner

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function Roulette({ pool, winner, spinning, onSpinComplete }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tickAudioTimer = useRef<number | null>(null);

  // Build a strip whenever a spin starts; winner is placed at WINNER_INDEX.
  const strip = useMemo<Item[]>(() => {
    if (pool.length === 0) return [];
    const arr: Item[] = [];
    for (let i = 0; i < STRIP_LEN; i++) arr.push(randomFrom(pool));
    if (winner) arr[WINNER_INDEX] = winner;
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner?.id, pool.length]);

  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "settled">("idle");

  useEffect(() => {
    if (!spinning || !winner || !trackRef.current) return;

    // Reset to starting position instantly
    setPhase("idle");
    trackRef.current.style.transition = "none";
    setOffset(0);

    // Compute landing offset (center the winner under the marker).
    const container = trackRef.current.parentElement!;
    const containerW = container.clientWidth;
    const centerOfWinner = WINNER_INDEX * STEP + CARD_W / 2;
    const jitter = (Math.random() - 0.5) * (CARD_W * 0.6); // land slightly off-center for realism
    const target = -(centerOfWinner - containerW / 2 + jitter);

    // Trigger animation on next frame
    playSound("spin_start");
    requestAnimationFrame(() => {
      if (!trackRef.current) return;
      trackRef.current.style.transition =
        "transform 6.5s cubic-bezier(0.12, 0.62, 0.08, 1.0)";
      setOffset(target);
      setPhase("spinning");
    });

    // Ticking sound that slows as we approach the end
    let elapsed = 0;
    const totalMs = 6500;
    const tick = () => {
      if (elapsed >= totalMs) return;
      const progress = elapsed / totalMs;
      // gap grows from 50ms to 380ms
      const gap = 50 + Math.pow(progress, 2.2) * 330;
      playSound("tick");
      elapsed += gap;
      tickAudioTimer.current = window.setTimeout(tick, gap);
    };
    tick();

    const slowTimer = window.setTimeout(() => playSound("slow_down"), 5400);
    const doneTimer = window.setTimeout(() => {
      setPhase("settled");
      onSpinComplete();
    }, totalMs + 80);

    return () => {
      if (tickAudioTimer.current) window.clearTimeout(tickAudioTimer.current);
      window.clearTimeout(slowTimer);
      window.clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, winner?.id]);

  return (
    <div className="relative w-full">
      <div className="roulette-track-mask relative overflow-hidden rounded-2xl border border-border surface-premium px-2 py-4">
        <div className="roulette-marker" aria-hidden />
        <div
          ref={trackRef}
          className="flex"
          style={{
            gap: `${CARD_GAP}px`,
            transform: `translateX(${offset}px)`,
            willChange: "transform",
          }}
        >
          {strip.map((it, i) => (
            <RouletteCard key={i} item={it} highlight={phase === "settled" && i === WINNER_INDEX} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RouletteCard({ item, highlight }: { item: Item; highlight: boolean }) {
  const cfg = categoryConfig(item.category);
  const isBenefit = item.type === "beneficio";
  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border relative flex flex-col items-center justify-between overflow-hidden",
        "px-3 py-3 text-center transition-transform",
        isBenefit ? "border-benefit/40" : "border-punish/40",
        highlight && "scale-105 animate-pulse-glow z-10"
      )}
      style={{
        width: CARD_W,
        height: 200,
        background: `linear-gradient(165deg,
          color-mix(in oklab, var(--${cfg.color}) 22%, var(--card)),
          var(--card) 60%,
          color-mix(in oklab, var(--${cfg.color}) 14%, var(--card)) 100%)`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `var(--${cfg.color})`, boxShadow: `0 0 18px var(--${cfg.color})` }}
      />
      <div
        className="text-[10px] uppercase tracking-[0.18em] font-semibold mt-1"
        style={{ color: `var(--${cfg.color})` }}
      >
        {isBenefit ? "Beneficio" : "Castigo"} · {cfg.label}
      </div>
      <div className="font-display text-base leading-tight font-bold line-clamp-3 px-1">
        {item.title}
      </div>
      <div className="text-[10px] text-muted-foreground line-clamp-2 px-1 opacity-80">
        {item.description}
      </div>
    </div>
  );
}

export function CategoryLegend() {
  const total = PROBABILITIES.reduce((s, p) => s + p.weight, 0);
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
      {PROBABILITIES.map((p) => (
        <div
          key={p.category}
          className="rounded-md border border-border/60 surface-premium px-2 py-2 text-center"
        >
          <div
            className="text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: `var(--${p.color})` }}
          >
            {p.type === "beneficio" ? "+" : "−"} {p.label}
          </div>
          <div className="text-xs text-muted-foreground">
            {((p.weight / total) * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}
