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

/** Som 1 — profissional aceitou a tarefa (toque ascendente, 2 notas) */
export const playAcceptSound = () => {
  if (!isRadarSoundEnabled()) return;
  const audio = getCtx();
  if (!audio) return;
  beep(audio, 660, 0, 0.18, "sine", 0.2);
  beep(audio, 990, 0.14, 0.28, "sine", 0.2);
};

/** Som 2 — profissional chegou ao endereço (buzina 2 tons + confirmação) */
export const playArrivalSound = () => {
  if (!isRadarSoundEnabled()) return;
  const audio = getCtx();
  if (!audio) return;
  beep(audio, 440, 0, 0.22, "square", 0.12);
  beep(audio, 440, 0.3, 0.22, "square", 0.12);
  beep(audio, 880, 0.6, 0.35, "sine", 0.2);
};

/** Pré-aquece o AudioContext num gesto do usuário (política de autoplay) */
export const primeRadarAudio = () => {
  getCtx();
};
