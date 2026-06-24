// Modular sound system using the Web Audio API.
// Each sound is generated procedurally so files are not required out of the box,
// but every entry can be swapped for an audio file by setting `url`.

type SoundKey = "spin_start" | "tick" | "slow_down" | "benefit" | "punish" | "close";

interface SoundDef {
  url?: string; // optional: drop an mp3/ogg in public/sounds and set its path here
  fallback: (ctx: AudioContext) => void;
}

let _ctx: AudioContext | null = null;
function ctx() {
  if (typeof window === "undefined") return null;
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx;
}

function beep(c: AudioContext, freq: number, dur: number, type: OscillatorType = "square", gain = 0.07) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur);
}

function chord(c: AudioContext, freqs: number[], dur: number, type: OscillatorType = "sine", gain = 0.07) {
  freqs.forEach((f) => beep(c, f, dur, type, gain));
}

const SOUNDS: Record<SoundKey, SoundDef> = {
  spin_start: { fallback: (c) => chord(c, [220, 330], 0.18, "sawtooth", 0.08) },
  tick:       { fallback: (c) => beep(c, 880, 0.04, "square", 0.05) },
  slow_down:  { fallback: (c) => beep(c, 440, 0.18, "triangle", 0.06) },
  benefit:    { fallback: (c) => chord(c, [523.25, 659.25, 783.99, 1046.5], 0.6, "sine", 0.09) },
  punish:     { fallback: (c) => chord(c, [196, 155.56, 116.54], 0.7, "sawtooth", 0.09) },
  close:      { fallback: (c) => beep(c, 320, 0.08, "sine", 0.05) },
};

const audioCache: Record<string, HTMLAudioElement> = {};

export function playSound(key: SoundKey) {
  try {
    const def = SOUNDS[key];
    if (def.url) {
      let a = audioCache[def.url];
      if (!a) { a = new Audio(def.url); audioCache[def.url] = a; }
      a.currentTime = 0;
      void a.play().catch(() => {});
      return;
    }
    const c = ctx();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    def.fallback(c);
  } catch {
    /* swallow audio errors silently */
  }
}
