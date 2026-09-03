/* ------------------------------------------------------------------ */
/*  Avisos sonoros do Radar (Web Audio, sem assets)                    */
/* ------------------------------------------------------------------ */

const PREF_KEY = "radar_sound_enabled";

let ctx: AudioContext | null = null;

export const isRadarSoundEnabled = () =>
  typeof window !== "undefined" && localStorage.getItem(PREF_KEY) !== "off";

export const setRadarSoundEnabled = (on: boolean) => {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* noop */
  }
};

const getCtx = () => {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

const beep = (
  audio: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.18
) => {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audio.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
};

/** Som 1 — profissional aceitou a tarefa (fanfarra ascendente, ~2s) */
export const playAcceptSound = () => {
  if (!isRadarSoundEnabled()) return;
  const audio = getCtx();
  if (!audio) return;
  // arpejo ascendente + acorde final sustentado
  const notes: Array<[number, number, number]> = [
    [523.25, 0.0, 0.32],
    [659.25, 0.24, 0.32],
    [783.99, 0.48, 0.34],
    [1046.5, 0.74, 0.5],
  ];
  notes.forEach(([f, t, d]) => beep(audio, f, t, d, "sine", 0.18));
  // acorde final (mais longo)
  beep(audio, 523.25, 1.2, 0.9, "triangle", 0.12);
  beep(audio, 659.25, 1.2, 0.95, "sine", 0.12);
  beep(audio, 783.99, 1.2, 1.0, "sine", 0.14);
};

/** Som 2 — profissional chegou ao endereço (buzina repetida + confirmação, ~2,4s) */
export const playArrivalSound = () => {
  if (!isRadarSoundEnabled()) return;
  const audio = getCtx();
  if (!audio) return;
  // três toques de buzina
  [0, 0.42, 0.84].forEach((t) => {
    beep(audio, 415, t, 0.3, "square", 0.1);
    beep(audio, 622, t + 0.02, 0.3, "square", 0.08);
  });
  // confirmação em duas notas longas
  beep(audio, 880, 1.35, 0.5, "sine", 0.18);
  beep(audio, 1174.7, 1.75, 0.75, "sine", 0.18);
  beep(audio, 587.33, 1.75, 0.8, "triangle", 0.1);
};

/** Pré-aquece o AudioContext num gesto do usuário (política de autoplay) */
export const primeRadarAudio = () => {
  getCtx();
};
