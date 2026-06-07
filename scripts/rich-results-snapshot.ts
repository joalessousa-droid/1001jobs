#!/usr/bin/env -S npx tsx
/**
 * Versioned Rich Results snapshot.
 *
 * Reads ./reports/post-publish-summary.json (produced by post-publish-verify.ts)
 * and appends a normalized snapshot to ./reports/rich-results-history.json.
 *
 * The history file is committed to the repo so you can diff regressions between
 * deploys without depending only on the Lighthouse score.
 *
 * Schema of each entry:
 *   { timestamp, commit, branch, site, faqUrl, status, warnings[], questions,
 *     canonical, sitemap: { errors, warnings }, scoreDelta? }
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const REPORT_DIR = resolve(process.env.REPORT_DIR || "./reports");
const HISTORY_FILE = join(REPORT_DIR, "rich-results-history.json");
const SUMMARY = join(REPORT_DIR, "post-publish-summary.json");
const MAX_ENTRIES = Number(process.env.RICH_RESULTS_HISTORY_MAX || 100);

mkdirSync(REPORT_DIR, { recursive: true });

if (!existsSync(SUMMARY)) {
  console.error(`Missing ${SUMMARY}. Run post-publish-verify.ts first.`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
const sitemapTotals = (summary.sitemapStatus || []).reduce(
  (a: { errors: number; warnings: number }, sm: any) => ({
    errors: a.errors + Number(sm.errors ?? 0),
    warnings: a.warnings + Number(sm.warnings ?? 0),
  }),
  { errors: 0, warnings: 0 },
);

const canonicalStep = (summary.steps || []).find((s: any) => s.name === "canonical_consistency");
const robotsStep = (summary.steps || []).find((s: any) => s.name === "robots_consistency");

const entry = {
  timestamp: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || process.env.COMMIT_SHA || null,
  branch: process.env.GITHUB_REF_NAME || process.env.BRANCH || null,
  runUrl: process.env.GITHUB_RUN_URL || null,
  site: summary.site,
  faqUrl: summary.faqUrl,
  status: summary.faq?.found ? (summary.faq.warnings?.length ? "warning" : "valid") : "missing",
  questions: summary.faq?.questions ?? 0,
  warnings: summary.faq?.warnings ?? [],
  canonical: canonicalStep ? { ok: canonicalStep.ok, detail: canonicalStep.detail } : null,
  robots: robotsStep ? { ok: robotsStep.ok, detail: robotsStep.detail } : null,
  sitemap: sitemapTotals,
  overallOk: summary.ok,
};

const history = existsSync(HISTORY_FILE)
  ? JSON.parse(readFileSync(HISTORY_FILE, "utf8"))
  : { entries: [] as any[] };

// Compute regression vs previous
const prev = history.entries[history.entries.length - 1];
if (prev) {
  (entry as any).regression = {
    statusChanged: prev.status !== entry.status,
    newWarnings: entry.warnings.filter((w: string) => !prev.warnings?.includes(w)),
    resolvedWarnings: (prev.warnings ?? []).filter((w: string) => !entry.warnings.includes(w)),
    sitemapErrorsDelta: entry.sitemap.errors - (prev.sitemap?.errors ?? 0),
  };
}

history.entries.push(entry);
if (history.entries.length > MAX_ENTRIES) history.entries = history.entries.slice(-MAX_ENTRIES);

writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
console.log(`✓ Snapshot appended (${history.entries.length} total) → ${HISTORY_FILE}`);
console.log(`  status=${entry.status} questions=${entry.questions} warnings=${entry.warnings.length} sitemapErrors=${entry.sitemap.errors}`);
if ((entry as any).regression) {
  const r = (entry as any).regression;
  if (r.statusChanged) console.log(`  ⚠ status changed from "${prev.status}" → "${entry.status}"`);
  if (r.newWarnings.length) console.log(`  ⚠ new warnings: ${r.newWarnings.join("; ")}`);
  if (r.resolvedWarnings.length) console.log(`  ✓ resolved warnings: ${r.resolvedWarnings.join("; ")}`);
}
