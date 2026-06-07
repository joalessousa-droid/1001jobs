#!/usr/bin/env -S npx tsx
/**
 * Lighthouse CI — runs against the published URLs and fails if any
 * category score regresses below the configured threshold.
 *
 *   npx tsx scripts/lighthouse-ci.ts
 *
 * Requires Chrome/Chromium on PATH. In GitHub Actions, the
 * `lhci-action` ubuntu image already ships Chrome; locally you can
 * `brew install --cask google-chrome` or use Docker.
 *
 * Wire to your hosting provider's "deploy succeeded" webhook, or run
 * as a post-deploy GitHub Action step.
 */
import { execSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const URLS = [
  "https://jobs1001.lovable.app/como-funciona",
  "https://jobs1001.lovable.app/buscar",
];

// Minimum acceptable Lighthouse score per category (0–1).
const THRESHOLDS = { performance: 0.7, accessibility: 0.9, seo: 0.95 } as const;

const failures: string[] = [];

for (const url of URLS) {
  console.log(`\n▸ Lighthouse: ${url}`);
  const dir = mkdtempSync(join(tmpdir(), "lh-"));
  const out = join(dir, "report.json");
  try {
    execSync(
      `npx --yes lighthouse "${url}" --quiet --chrome-flags="--headless --no-sandbox" ` +
        `--only-categories=performance,accessibility,seo --output=json --output-path="${out}"`,
      { stdio: "inherit" },
    );
  } catch (e) {
    failures.push(`${url}: Lighthouse run failed`);
    continue;
  }
  const report = JSON.parse(readFileSync(out, "utf8"));
  for (const [cat, min] of Object.entries(THRESHOLDS) as [keyof typeof THRESHOLDS, number][]) {
    const score = report.categories?.[cat]?.score ?? 0;
    const pct = Math.round(score * 100);
    const status = score >= min ? "✓" : "✗";
    console.log(`  ${status} ${cat}: ${pct} (min ${min * 100})`);
    if (score < min) failures.push(`${url} ${cat}=${pct} (min ${min * 100})`);
  }
}

if (failures.length) {
  console.error("\n❌ Lighthouse regressions detected:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\n✅ All Lighthouse audits passed thresholds.\n");
