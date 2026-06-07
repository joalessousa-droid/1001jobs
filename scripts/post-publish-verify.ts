#!/usr/bin/env -S npx tsx
/**
 * Post-publish verification script.
 *
 * Configuration via environment variables (all optional):
 *   SITE_URL                  Origin to verify. Defaults to
 *                             https://jobs1001.lovable.app
 *   SITEMAP_URL               Defaults to <SITE_URL>/sitemap.xml
 *   FAQ_PATH                  Page that must carry the FAQPage JSON-LD.
 *                             Defaults to /como-funciona
 *   REPORT_DIR                Defaults to ./reports
 *
 * Required env: LOVABLE_API_KEY, GOOGLE_SEARCH_CONSOLE_API_KEY
 *
 * Writes ./reports/post-publish-summary.json for the report generator.
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const SITE = (process.env.SITE_URL || "https://jobs1001.lovable.app").replace(/\/$/, "");
const SITEMAP_URL = process.env.SITEMAP_URL || `${SITE}/sitemap.xml`;
const FAQ_PATH = process.env.FAQ_PATH || "/como-funciona";
const FAQ_URL = `${SITE}${FAQ_PATH}`;
const SITE_ENCODED = encodeURIComponent(SITE + "/");
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const REPORT_DIR = resolve(process.env.REPORT_DIR || "./reports");
mkdirSync(REPORT_DIR, { recursive: true });

const { LOVABLE_API_KEY, GOOGLE_SEARCH_CONSOLE_API_KEY } = process.env;
if (!LOVABLE_API_KEY || !GOOGLE_SEARCH_CONSOLE_API_KEY) {
  console.error("Missing LOVABLE_API_KEY or GOOGLE_SEARCH_CONSOLE_API_KEY env var.");
  process.exit(1);
}
const gscHeaders = {
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GOOGLE_SEARCH_CONSOLE_API_KEY,
  "Content-Type": "application/json",
};

interface Step { name: string; ok: boolean; detail: string }
const steps: Step[] = [];
const log = (s: string) => console.log(`\n▸ ${s}`);
const record = (name: string, ok: boolean, detail: string) => {
  steps.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${detail}`);
};

let faqResult: any = { found: false, questions: 0, warnings: [] as string[] };
let sitemapStatus: any[] = [];

// 1. Fetch FAQ page ---------------------------------------------------------
log(`Fetching ${FAQ_URL}`);
const pageRes = await fetch(FAQ_URL, { redirect: "follow" });
if (!pageRes.ok) {
  record("fetch_faq_page", false, `HTTP ${pageRes.status} fetching ${FAQ_URL}`);
} else {
  record("fetch_faq_page", true, `HTTP ${pageRes.status}, ${(await pageRes.clone().text()).length} bytes`);
}
const html = pageRes.ok ? await pageRes.text() : "";

// 2. Parse JSON-LD blocks; isolate FAQPage ----------------------------------
log("Extracting JSON-LD blocks");
const blocks = [
  ...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g),
].map((m, i) => ({ index: i, raw: m[1].trim() }));

const parsed = blocks.map((b) => {
  try { return { ...b, json: JSON.parse(b.raw), error: null as string | null }; }
  catch (e) { return { ...b, json: null, error: (e as Error).message }; }
});

const parseErrors = parsed.filter((b) => b.error);
const faqCandidates = parsed
  .filter((b) => b.json)
  .flatMap((b) => {
    const arr = Array.isArray(b.json) ? b.json : [b.json];
    // Handle @graph wrappers too.
    return arr.flatMap((node: any) =>
      Array.isArray(node?.["@graph"]) ? node["@graph"] : [node],
    ).map((node: any) => ({ blockIndex: b.index, node }));
  })
  .filter(({ node }) => node?.["@type"] === "FAQPage");

if (parseErrors.length) {
  record("json_ld_parse", false, `${parseErrors.length} block(s) failed to parse: ${parseErrors.map((e) => `#${e.index}: ${e.error}`).join("; ")}`);
} else {
  record("json_ld_parse", true, `${blocks.length} block(s), all parsed`);
}

if (faqCandidates.length === 0) {
  const typesSeen = parsed.flatMap((b) => {
    const arr = Array.isArray(b.json) ? b.json : [b.json];
    return arr.flatMap((n: any) => (Array.isArray(n?.["@graph"]) ? n["@graph"] : [n]))
      .map((n: any) => n?.["@type"] ?? "(none)");
  });
  record(
    "faq_present",
    false,
    `No FAQPage JSON-LD found on ${FAQ_URL}. Scanned ${blocks.length} block(s); @type values seen: [${typesSeen.join(", ")}]. ` +
      `If you just republished, wait 30s for CDN propagation and retry.`,
  );
} else if (faqCandidates.length > 1) {
  record("faq_present", false, `Multiple FAQPage blocks found (${faqCandidates.length}) — Google may pick the wrong one.`);
} else {
  const faq = faqCandidates[0].node;
  const warns: string[] = [];
  if (!Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0) warns.push("mainEntity missing or empty");
  for (const [i, q] of (faq.mainEntity ?? []).entries()) {
    if (q?.["@type"] !== "Question") warns.push(`mainEntity[${i}].@type !== Question`);
    if (!q?.name) warns.push(`mainEntity[${i}].name missing`);
    if (q?.acceptedAnswer?.["@type"] !== "Answer") warns.push(`mainEntity[${i}].acceptedAnswer.@type !== Answer`);
    if (!q?.acceptedAnswer?.text) warns.push(`mainEntity[${i}].acceptedAnswer.text missing`);
  }
  faqResult = { found: true, questions: faq.mainEntity?.length ?? 0, warnings: warns, blockIndex: faqCandidates[0].blockIndex };
  if (warns.length) {
    record("faq_present", false, `FAQPage found in block #${faqCandidates[0].blockIndex}, ${warns.length} warning(s): ${warns.join("; ")}`);
  } else {
    record("faq_present", true, `FAQPage found in block #${faqCandidates[0].blockIndex}: ${faq.mainEntity.length} Q/A pairs, zero warnings`);
  }
}

// 3. GSC verify -------------------------------------------------------------
log("Verifying site in Google Search Console");
const vRes = await fetch(`${GATEWAY}/siteVerification/v1/webResource?verificationMethod=META`, {
  method: "POST", headers: gscHeaders,
  body: JSON.stringify({ site: { identifier: `${SITE}/`, type: "SITE" } }),
});
const vBody = await vRes.text();
record("gsc_verify", vRes.ok, vRes.ok ? "Site verified" : `HTTP ${vRes.status}: ${vBody.slice(0, 200)}`);

// 4. Add to GSC -------------------------------------------------------------
log("Adding site to Search Console");
const aRes = await fetch(`${GATEWAY}/webmasters/v3/sites/${SITE_ENCODED}`, { method: "PUT", headers: gscHeaders });
record("gsc_add_site", aRes.ok || aRes.status === 204, `HTTP ${aRes.status}`);

// 5. Submit sitemap ---------------------------------------------------------
log("Submitting sitemap");
const sRes = await fetch(
  `${GATEWAY}/webmasters/v3/sites/${SITE_ENCODED}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`,
  { method: "PUT", headers: gscHeaders },
);
record("gsc_sitemap_submit", sRes.ok || sRes.status === 204, `HTTP ${sRes.status}`);

// 6. Sitemap status from GSC ------------------------------------------------
log("Reading sitemap status");
const stRes = await fetch(`${GATEWAY}/webmasters/v3/sites/${SITE_ENCODED}/sitemaps`, { headers: gscHeaders });
if (stRes.ok) {
  const body = await stRes.json() as any;
  sitemapStatus = body.sitemap ?? [];
  for (const sm of sitemapStatus) {
    const errs = Number(sm.errors ?? 0), warns = Number(sm.warnings ?? 0);
    const ok = errs === 0 && warns === 0;
    record(`sitemap:${sm.path}`, ok, `errors=${errs}, warnings=${warns}, lastSubmitted=${sm.lastSubmitted ?? "—"}`);
  }
} else {
  record("gsc_sitemap_status", false, `HTTP ${stRes.status}`);
}

// Write summary -------------------------------------------------------------
const summary = {
  generatedAt: new Date().toISOString(),
  site: SITE, faqUrl: FAQ_URL, sitemapUrl: SITEMAP_URL,
  faq: faqResult,
  sitemapStatus,
  steps,
  ok: steps.every((s) => s.ok),
};
writeFileSync(join(REPORT_DIR, "post-publish-summary.json"), JSON.stringify(summary, null, 2));

if (!summary.ok) {
  console.error("\n❌ Post-publish verification failed.");
  process.exit(1);
}
console.log("\n✅ Post-publish verification complete.\n");
