// Pure helpers shared by the tracking UI and tests.

export type TrafficLevel = "free" | "moderate" | "intense";

export interface EtaHistoryEntry {
  at: string; // ISO timestamp
  eta_seconds: number;
  avg_speed_kmh?: number | null;
  traffic_factor?: number | null;
}

export interface EtaHistoryPoint extends EtaHistoryEntry {
  /** Delta vs. previous sample, in seconds. Positive = slower. */
  deltaSec: number | null;
  /** Human label "há 2 min" */
  relativeLabel: string;
}

export const classifyTraffic = (factor: number | null | undefined): TrafficLevel | null => {
  if (factor == null || !Number.isFinite(factor)) return null;
  if (factor >= 1.2) return "intense";
  if (factor >= 1.05) return "moderate";
  return "free";
};

export const formatEta = (sec: number | null | undefined): string => {
  if (sec == null || sec <= 0) return "—";
  if (sec < 60) return "< 1 min";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m ? ` ${m}min` : ""}`;
};

export const formatRelative = (iso: string, nowMs = Date.now()): string => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffSec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (diffSec < 60) return `há ${diffSec}s`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return `há ${h}h`;
};

/**
 * Build a normalized history for display: chronological, with per-step delta
 * vs. the previous entry. Returns at most `limit` most recent entries.
 */
export const buildEtaHistoryPoints = (
  history: EtaHistoryEntry[] | null | undefined,
  limit = 8,
  nowMs = Date.now(),
): EtaHistoryPoint[] => {
  if (!Array.isArray(history) || history.length === 0) return [];
  const sorted = [...history]
    .filter(
      (e) =>
        e &&
        typeof e.at === "string" &&
        Number.isFinite(new Date(e.at).getTime()) &&
        Number.isFinite(e.eta_seconds),
    )
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return sorted.slice(-limit).map((entry, idx, arr) => ({
    ...entry,
    deltaSec: idx === 0 ? null : entry.eta_seconds - arr[idx - 1].eta_seconds,
    relativeLabel: formatRelative(entry.at, nowMs),
  }));
};

/** Resolve a numeric env var with a default and min/max bounds. */
export const resolveNumericEnv = (
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
