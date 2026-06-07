// Integration-flavored tests for the eta-alerts-monitor logic.
// We test the pure decision/aggregation/template helpers and webhook matching.
// No network access required.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aggregate,
  decide,
  webhookMatches,
  renderTemplate,
  buildTemplateContext,
  parseEnvWebhookList,
  type MetricSample,
  type Thresholds,
} from "./lib.ts";

const T: Thresholds = {
  windowMin: 15, minSamples: 10, failRateThresh: 0.25, p95Thresh: 3000, cooldownMin: 30,
};

const makeSamples = (n: number, failFrac: number, dur = 800, region = "São Paulo|SP"): MetricSample[] =>
  Array.from({ length: n }, (_, i) => ({
    ts: new Date().toISOString(),
    ok: i / n >= failFrac,
    duration_ms: dur + (i % 10) * 20,
    traffic_factor: 1.1 + (i % 5) * 0.1,
    region_key: region,
    provider_id: i % 3 === 0 ? "prov-a" : "prov-b",
    category_id: "cat-1",
  }));

Deno.test("decide: skipped when below minSamples", () => {
  const agg = aggregate(makeSamples(5, 0.8));
  const d = decide(agg, T, false);
  assertEquals(d.status, "skipped_insufficient");
});

Deno.test("decide: healthy when below thresholds", () => {
  const agg = aggregate(makeSamples(40, 0.05, 400));
  assertEquals(decide(agg, T, false).status, "healthy");
});

Deno.test("decide: persistent_degradation on high failure rate", () => {
  const agg = aggregate(makeSamples(40, 0.6, 700));
  const d = decide(agg, T, false);
  assertEquals(d.status, "alert");
  assertEquals(d.alertType, "persistent_degradation");
  assertEquals(d.severity, "critical");
});

Deno.test("decide: slow_responses on high p95 only", () => {
  const agg = aggregate(makeSamples(40, 0.05, 5000));
  const d = decide(agg, T, false);
  assertEquals(d.status, "alert");
  assertEquals(d.alertType, "slow_responses");
});

Deno.test("decide: cooldown prevents duplicate alerts", () => {
  const agg = aggregate(makeSamples(40, 0.6));
  assertEquals(decide(agg, T, true).status, "skipped_cooldown");
});

Deno.test("aggregate: top cities and providers ordered by failures", () => {
  const samples: MetricSample[] = [
    { ts: "t", ok: false, region_key: "Rio|RJ", provider_id: "p1", duration_ms: 1000 },
    { ts: "t", ok: false, region_key: "Rio|RJ", provider_id: "p1", duration_ms: 1000 },
    { ts: "t", ok: false, region_key: "SP|SP", provider_id: "p2", duration_ms: 1000 },
    { ts: "t", ok: true,  region_key: "SP|SP", provider_id: "p2", duration_ms: 1000 },
  ];
  const agg = aggregate(samples);
  assertEquals(agg.topCities[0].key, "Rio");
  assertEquals(agg.topProviders[0].key, "p1");
});

Deno.test("webhookMatches: severity and alert_types filter", () => {
  const hook = { is_active: true, alert_types: ["persistent_degradation"], min_severity: "high" };
  assert(webhookMatches(hook, "persistent_degradation", "critical"));
  assert(!webhookMatches(hook, "slow_responses", "critical"));
  assert(!webhookMatches(hook, "persistent_degradation", "medium"));
  assert(!webhookMatches({ ...hook, is_active: false }, "persistent_degradation", "critical"));
  assert(webhookMatches({ ...hook, alert_types: [] }, "anything", "high"));
});

Deno.test("renderTemplate: replaces placeholders, leaves unknown empty", () => {
  const out = renderTemplate("Hi {{name}}, fails {{failure_pct}}%, x={{missing}}", { name: "Ana", failure_pct: "42.0" });
  assertEquals(out, "Hi Ana, fails 42.0%, x=");
});

Deno.test("buildTemplateContext: contains key fields", () => {
  const agg = aggregate(makeSamples(20, 0.5));
  const ctx = buildTemplateContext({
    alertType: "persistent_degradation", windowMin: 15,
    periodFrom: new Date().toISOString(), periodTo: new Date().toISOString(),
    agg, tuning: [{ scope: "global", ema_alpha: 0.2 }],
    dashboardUrl: "https://app/admin/eta",
  });
  assertEquals(ctx.alert_type, "persistent_degradation");
  assertEquals(ctx.samples, 20);
  assert(ctx.tuning_json.includes("ema_alpha"));
  assert(ctx.top_cities_html.includes("São Paulo"));
});

Deno.test("parseEnvWebhookList: accepts name|url and bare urls", () => {
  const list = parseEnvWebhookList("slack|https://hooks.slack.com/x, https://example.com/wh, invalid");
  assertEquals(list.length, 2);
  assertEquals(list[0], { name: "slack", url: "https://hooks.slack.com/x" });
  assertEquals(list[1].url, "https://example.com/wh");
});

Deno.test("integration: full pipeline persists correct fields shape", () => {
  // Simulates what index.ts would write — verifies no field drift.
  const agg = aggregate(makeSamples(40, 0.6, 900));
  const dec = decide(agg, T, false);
  assertEquals(dec.status, "alert");

  const row = {
    alert_type: dec.alertType,
    severity: dec.severity,
    samples: agg.samples,
    failures: agg.failures,
    failure_rate: Number(agg.failureRate.toFixed(4)),
    avg_duration_ms: agg.avgDur,
    p95_duration_ms: agg.p95,
    avg_traffic_factor: agg.avgTraffic,
    city: agg.topRegion?.split("|")[0] ?? null,
    provider_id: agg.topProvider,
    summary: { top_cities: agg.topCities },
  };
  assertEquals(row.alert_type, "persistent_degradation");
  assertEquals(row.severity, "critical");
  assert(row.failure_rate >= 0.5);
  assertEquals(row.city, "São Paulo");
  assert(Array.isArray(row.summary.top_cities));
});
