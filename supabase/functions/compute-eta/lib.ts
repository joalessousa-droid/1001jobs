// Pure helpers for ETA computation. No Deno-specific imports here so they can be
// unit-tested in isolation with fixtures.

export type TrafficLevel = "free" | "moderate" | "intense";

export interface EtaInputs {
  /** Google Routes traffic-aware duration, seconds */
  etaTrafficSec: number;
  /** Google Routes static (free-flow) duration, seconds */
  staticSec: number;
  /** Route distance, meters */
  distanceMeters: number;
  /** Regional historical average speed, km/h (null if no samples) */
  regionalSpeedKmh: number | null;
  /** Number of samples behind regionalSpeedKmh */
  regionalSampleCount: number | null;
  /** Max weight given to regional baseline, [0,1]. Default 0.4 */
  maxRegionalWeight?: number;
}

export interface EtaResult {
  adjustedEtaSec: number;
  avgSpeedKmh: number | null;
  trafficFactor: number | null;
  regionalWeight: number;
  trafficLevel: TrafficLevel | null;
}

/** Classify traffic intensity from `etaTraffic / staticDuration` ratio. */
export const classifyTraffic = (factor: number | null): TrafficLevel | null => {
  if (factor == null || !Number.isFinite(factor)) return null;
  if (factor >= 1.2) return "intense";
  if (factor >= 1.05) return "moderate";
  return "free";
};

/** Average speed (km/h) for a leg covered in `sec` seconds. */
export const computeAvgSpeedKmh = (distanceMeters: number, sec: number): number | null => {
  if (!(sec > 0) || !(distanceMeters > 0)) return null;
  return Number(((distanceMeters / 1000) / (sec / 3600)).toFixed(2));
};

/**
 * Blend Google traffic-aware ETA with regional-history estimate.
 * Weight grows with sample count, capped at `maxRegionalWeight` (default 0.4).
 * When regional data is missing or unreliable, falls back to Google ETA.
 */
export const computeAdjustedEta = (i: EtaInputs): EtaResult => {
  const { etaTrafficSec, staticSec, distanceMeters, regionalSpeedKmh, regionalSampleCount } = i;
  const maxW = i.maxRegionalWeight ?? 0.4;

  const avgSpeedKmh = computeAvgSpeedKmh(distanceMeters, etaTrafficSec);
  const trafficFactor =
    staticSec > 0 && etaTrafficSec > 0 ? Number((etaTrafficSec / staticSec).toFixed(3)) : null;

  let adjustedEtaSec = etaTrafficSec;
  let regionalWeight = 0;
  if (regionalSpeedKmh && regionalSpeedKmh > 5 && distanceMeters > 0 && etaTrafficSec > 0) {
    const regionalEta = (distanceMeters / 1000) / regionalSpeedKmh * 3600;
    regionalWeight = Math.min(maxW, (regionalSampleCount ?? 1) / 50);
    adjustedEtaSec = Math.round(etaTrafficSec * (1 - regionalWeight) + regionalEta * regionalWeight);
  }

  return {
    adjustedEtaSec,
    avgSpeedKmh,
    trafficFactor,
    regionalWeight,
    trafficLevel: classifyTraffic(trafficFactor),
  };
};

/**
 * Resolve EMA alpha for regional traffic update from env config.
 * Supports a default value and optional per "dow:hour" overrides as JSON.
 *
 * ETA_EMA_ALPHA_DEFAULT="0.2"
 * ETA_EMA_ALPHA_OVERRIDES='{"1:8":0.35,"5:18":0.4}'  // Monday 8h / Friday 18h
 */
export const resolveEmaAlpha = (
  envDefault: string | undefined,
  envOverrides: string | undefined,
  dow: number,
  hour: number,
): number => {
  const fallback = 0.2;
  let base = Number(envDefault);
  if (!Number.isFinite(base) || base <= 0 || base >= 1) base = fallback;
  if (!envOverrides) return base;
  try {
    const map = JSON.parse(envOverrides) as Record<string, number>;
    const key = `${dow}:${hour}`;
    const v = Number(map[key]);
    if (Number.isFinite(v) && v > 0 && v < 1) return v;
  } catch {
    /* ignore parse errors */
  }
  return base;
};

/** Build a structured log entry for ETA metrics. */
export interface EtaMetric {
  service_id: string;
  ok: boolean;
  duration_ms: number;
  status: number | null;
  distance_meters: number | null;
  eta_seconds: number | null;
  traffic_factor: number | null;
  traffic_level: TrafficLevel | null;
  regional_weight: number | null;
  retries?: number;
  error?: string;
}

/**
 * Retry an async operation with exponential backoff + full jitter.
 * Returns value and total attempts (1 = success on first try). Throws last error.
 */
export interface RetryOptions {
  retries?: number;        // additional attempts (default 2 => up to 3 calls)
  baseMs?: number;         // base delay (default 200)
  capMs?: number;          // cap (default 2000)
  shouldRetry?: (err: unknown) => boolean;
  onAttempt?: (attempt: number, delayMs: number, err: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<{ value: T; attempts: number }> => {
  const retries = opts.retries ?? 2;
  const base = opts.baseMs ?? 200;
  const cap = opts.capMs ?? 2000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const rand = opts.rand ?? Math.random;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (attempt > retries || (opts.shouldRetry && !opts.shouldRetry(err))) break;
      const expo = Math.min(cap, base * 2 ** (attempt - 1));
      const delay = Math.round(rand() * expo); // full jitter
      opts.onAttempt?.(attempt, delay, err);
      await sleep(delay);
    }
  }
  throw lastErr;
};

