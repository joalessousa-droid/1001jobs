#!/usr/bin/env -S npx tsx
/**
 * Lighthouse CI — runs against the published URLs and fails if any
 * category score regresses below the configured threshold.
 *
 *   npx tsx scripts/lighthouse-ci.ts
 *
 * Configuration via environment variables (all optional):
 *   LH_URLS                  Comma-separated full URLs. Defaults to
 *                            https://jobs1001.lovable.app/como-funciona,
 *                            https://jobs1001.lovable.app/buscar
 *   LH_BASE_URL              Base origin to prefix LH_PATHS with.
 *                            Defaults to https://jobs1001.lovable.app
 *   LH_PATHS                 Comma-separated paths (joined to LH_BASE_URL).
 *                            Defaults to /como-funciona,/buscar
 *   LH_MIN_PERFORMANCE       0-1, default 0.70
 *   LH_MIN_ACCESSIBILITY     0-1, default 0.90
 *   LH_MIN_SEO               0-1, default 0.95
 *   LH_REPORT_DIR            Where to write JSON + HTML reports.
 *                            Defaults to ./reports
 *
 * Writes per-URL JSON + HTML reports + a `lighthouse-summary.json` to
 * LH_REPORT_DIR for the report generator + CI artifact upload.
 */
import { execSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const env = process.env;
const num = (k: string, d: number) => {
  const v = env[k];
  if (!v) return d;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0 || n > 1) {
    console.error(`Invalid ${k}=${v} — must be a number 0..1`);
    process.exit(1);
  }
  return n;
};

const BASE = env.LH_BASE_URL || "https://jobs1001.lovable.app";
const URLS = (env.LH_URLS
  ? env.LH_URLS.split(",")
  : (env.LH_PATHS || "/como-funciona,/buscar").split(",").map((p) => BASE.replace(/\/$/, "") + p.trim())
).map((u) => u.trim()).filter(Boolean);

const THRESHOLDS = {
  performance: num("LH_MIN_PERFORMANCE", 0.7),
  accessibility: num("LH_MIN_ACCESSIBILITY", 0.9),
  seo: num("LH_MIN_SEO", 0.95),
} as const;

const REPORT_DIR = resolve(env.LH_REPORT_DIR || "./reports");
mkdirSync(REPORT_DIR, { recursive: true });

interface UrlResult {
  url: string;
  ok: boolean;
  scores: Record<string, number | null>;
  failures: string[];
  jsonPath: string;
  htmlPath: string;
  error?: string;
}

const results: UrlResult[] = [];

for (const url of URLS) {
  console.log(`\n▸ Lighthouse: ${url}`);
  const safe = url.replace(/[^a-z0-9]+/gi, "_");
  const jsonPath = join(REPORT_DIR, `lh-${safe}.json`);
  const htmlPath = join(REPORT_DIR, `lh-${safe}.html`);
  const r: UrlResult = { url, ok: true, scores: {}, failures: [], jsonPath, htmlPath };
  try {
    execSync(
      `npx --yes lighthouse "${url}" --quiet --chrome-flags="--headless --no-sandbox" ` +
        `--only-categories=performance,accessibility,seo ` +
        `--output=json --output=html --output-path="${join(REPORT_DIR, `lh-${safe}`)}"`,
      { stdio: "inherit" },
    );
  } catch (e) {
    r.ok = false;
    r.error = "Lighthouse run failed";
    r.failures.push(r.error);
    results.push(r);
    continue;
  }
  const report = JSON.parse(readFileSync(jsonPath, "utf8"));
  for (const [cat, min] of Object.entries(THRESHOLDS) as [keyof typeof THRESHOLDS, number][]) {
    const score: number = report.categories?.[cat]?.score ?? 0;
    r.scores[cat] = score;
    const pct = Math.round(score * 100);
    const status = score >= min ? "✓" : "✗";
    console.log(`  ${status} ${cat}: ${pct} (min ${min * 100})`);
    if (score < min) {
      r.ok = false;
      r.failures.push(`${cat}=${pct} (min ${min * 100})`);
    }
  }
  results.push(r);
}

const summary = {
  generatedAt: new Date().toISOString(),
  thresholds: THRESHOLDS,
  results,
  ok: results.every((r) => r.ok),
};
writeFileSync(join(REPORT_DIR, "lighthouse-summary.json"), JSON.stringify(summary, null, 2));

if (!summary.ok) {
  console.error("\n❌ Lighthouse regressions detected:");
  for (const r of results) for (const f of r.failures) console.error(`  - ${r.url}: ${f}`);
  process.exit(1);
}
console.log("\n✅ All Lighthouse audits passed thresholds.\n");
