// Pure logic for the ETA alerts monitor — extracted for testing.
// No network/DB I/O here.

export interface MetricSample {
  ts: string;
  ok: boolean;
  duration_ms?: number | null;
  traffic_factor?: number | null;
  traffic_level?: string | null;
  region_key?: string | null;
  category_id?: string | null;
  provider_id?: string | null;
}

export interface Thresholds {
  windowMin: number;
  minSamples: number;
  failRateThresh: number;
  p95Thresh: number;
  cooldownMin: number;
}

export interface AggResult {
  samples: number;
  failures: number;
  failureRate: number;
  avgDur: number;
  p95: number;
  avgTraffic: number | null;
  topRegion: string | null;
  topProvider: string | null;
  topCategory: string | null;
  topCities: Array<{ key: string; count: number }>;
  topProviders: Array<{ key: string; count: number }>;
}

export interface Decision {
  status: "skipped_insufficient" | "skipped_cooldown" | "healthy" | "alert";
  alertType?: "persistent_degradation" | "slow_responses";
  severity?: "critical" | "high";
}

export function aggregate(samples: MetricSample[]): AggResult {
  const failures = samples.filter((r) => !r.ok).length;
  const failureRate = samples.length ? failures / samples.length : 0;
  const durations = samples
    .filter((r) => r.ok && Number.isFinite(r.duration_ms as number))
    .map((r) => r.duration_ms as number)
    .sort((a, b) => a - b);
  const p95 = durations.length ? durations[Math.floor(durations.length * 0.95)] : 0;
  const avgDur = durations.length ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length) : 0;
  const tfs = samples.map((r) => r.traffic_factor).filter((v): v is number => Number.isFinite(v as number));
  const avgTraffic = tfs.length ? Number((tfs.reduce((s, v) => s + v, 0) / tfs.length).toFixed(3)) : null;

  const tally = (key: keyof MetricSample, onlyFailures = true) => {
    const m = new Map<string, number>();
    samples
      .filter((r) => (onlyFailures ? !r.ok : true) && r[key])
      .forEach((r) => {
        const k = String(r[key]);
        m.set(k, (m.get(k) ?? 0) + 1);
      });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
  };
  const regions = tally("region_key");
  const providers = tally("provider_id");
  const categories = tally("category_id");

  return {
    samples: samples.length,
    failures,
    failureRate,
    avgDur,
    p95,
    avgTraffic,
    topRegion: regions[0]?.key ?? null,
    topProvider: providers[0]?.key ?? null,
    topCategory: categories[0]?.key ?? null,
    topCities: regions.slice(0, 5).map((r) => ({ key: r.key.split("|")[0] ?? r.key, count: r.count })),
    topProviders: providers.slice(0, 5),
  };
}

export function decide(agg: AggResult, t: Thresholds, hasRecentAlert: boolean): Decision {
  if (agg.samples < t.minSamples) return { status: "skipped_insufficient" };
  const persistent = agg.failureRate > t.failRateThresh;
  const slow = agg.p95 > t.p95Thresh;
  if (!persistent && !slow) return { status: "healthy" };
  if (hasRecentAlert) return { status: "skipped_cooldown" };
  return {
    status: "alert",
    alertType: persistent ? "persistent_degradation" : "slow_responses",
    severity: agg.failureRate > 0.5 ? "critical" : "high",
  };
}

const SEV_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
export function severityAllows(min: string, actual: string): boolean {
  return (SEV_RANK[actual] ?? 0) >= (SEV_RANK[min] ?? 0);
}

export function webhookMatches(
  hook: { is_active: boolean; alert_types: string[] | null; min_severity: string },
  alertType: string,
  severity: string,
): boolean {
  if (!hook.is_active) return false;
  if (hook.alert_types && hook.alert_types.length > 0 && !hook.alert_types.includes(alertType)) return false;
  return severityAllows(hook.min_severity ?? "low", severity);
}

export interface TemplateContext {
  alert_type: string;
  window_min: number;
  period_from: string;
  period_to: string;
  samples: number;
  failures: number;
  failure_pct: string;
  avg_ms: number;
  p95_ms: number;
  avg_traffic: string;
  top_cities_html: string;
  top_providers_html: string;
  tuning_json: string;
  generated_at: string;
  dashboard_url: string;
}

export function renderTemplate(tpl: string, ctx: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = ctx[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function buildTemplateContext(opts: {
  alertType: string;
  windowMin: number;
  periodFrom: string;
  periodTo: string;
  agg: AggResult;
  tuning: unknown;
  dashboardUrl: string;
}): TemplateContext {
  const { alertType, windowMin, periodFrom, periodTo, agg, tuning, dashboardUrl } = opts;
  const list = (items: Array<{ key: string; count: number }>) =>
    items.length
      ? "<ul style=\"margin:0;padding-left:18px\">" +
        items.map((i) => `<li>${escapeHtml(i.key)} — ${i.count} falhas</li>`).join("") +
        "</ul>"
      : "<i>—</i>";
  return {
    alert_type: alertType,
    window_min: windowMin,
    period_from: new Date(periodFrom).toLocaleString(),
    period_to: new Date(periodTo).toLocaleString(),
    samples: agg.samples,
    failures: agg.failures,
    failure_pct: (agg.failureRate * 100).toFixed(1),
    avg_ms: agg.avgDur,
    p95_ms: agg.p95,
    avg_traffic: agg.avgTraffic !== null ? agg.avgTraffic.toFixed(2) : "—",
    top_cities_html: list(agg.topCities),
    top_providers_html: list(agg.topProviders),
    tuning_json: JSON.stringify(tuning ?? [], null, 2),
    generated_at: new Date().toISOString(),
    dashboard_url: dashboardUrl,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function backoffDelayMs(attempt: number, baseMs = 200, capMs = 4000): number {
  const expo = Math.min(capMs, baseMs * 2 ** (attempt - 1));
  return Math.round(Math.random() * expo);
}

export function parseEnvWebhookList(raw: string | undefined): Array<{ name: string; url: string }> {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [maybeName, ...rest] = entry.includes("|") ? entry.split("|") : ["", entry];
      const url = (rest.length ? rest.join("|") : maybeName).trim();
      const name = (rest.length ? maybeName : "env-webhook").trim() || "env-webhook";
      return { name, url };
    })
    .filter((w) => /^https?:\/\//.test(w.url));
}
