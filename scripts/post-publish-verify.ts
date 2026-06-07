#!/usr/bin/env -S npx tsx
/**
 * Post-publish verification script.
 *
 * Run AFTER republishing the site:
 *   npx tsx scripts/post-publish-verify.ts
 *
 * Performs, in order:
 *   1. Fetches the live /como-funciona page
 *   2. Extracts every JSON-LD <script> block, asserts a valid FAQPage
 *      schema (mainEntity Question/Answer pairs) with zero parse warnings.
 *   3. Calls Google Search Console siteVerification (META method) for the
 *      site root.
 *   4. PUTs the site to /webmasters/v3/sites (adds the verified property
 *      to GSC).
 *   5. PUTs the sitemap to /webmasters/v3/sites/<site>/sitemaps/<sitemap>.
 *   6. Lists any remaining flagged findings from the connector and prints
 *      them.
 *
 * Exits non-zero on the first failure so CI / a manual run surfaces the
 * problem clearly.
 *
 * Required environment:
 *   LOVABLE_API_KEY              (always present in the sandbox)
 *   GOOGLE_SEARCH_CONSOLE_API_KEY (set when the connector is linked)
 */
const SITE = "https://jobs1001.lovable.app";
const SITE_ENCODED = encodeURIComponent(SITE + "/");
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
const GSC_KEY = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;

if (!LOVABLE_API_KEY || !GSC_KEY) {
  console.error("Missing LOVABLE_API_KEY or GOOGLE_SEARCH_CONSOLE_API_KEY env var.");
  process.exit(1);
}

const gscHeaders = {
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GSC_KEY,
  "Content-Type": "application/json",
};

const log = (s: string) => console.log(`\n▸ ${s}`);
const ok = (s: string) => console.log(`  ✓ ${s}`);
const fail = (s: string): never => {
  console.error(`  ✗ ${s}`);
  process.exit(1);
};

// 1. Fetch /como-funciona ------------------------------------------------------
log(`Fetching ${SITE}/como-funciona`);
const pageRes = await fetch(`${SITE}/como-funciona`, { redirect: "follow" });
if (!pageRes.ok) fail(`HTTP ${pageRes.status} fetching page`);
const html = await pageRes.text();
ok(`HTTP ${pageRes.status}, ${html.length} bytes`);

// 2. Extract & validate FAQPage JSON-LD ---------------------------------------
log("Validating JSON-LD blocks");
const matches = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
if (matches.length === 0) fail("No JSON-LD <script> blocks found on /como-funciona");
ok(`Found ${matches.length} JSON-LD block(s)`);

let faq: any = null;
for (const [i, m] of matches.entries()) {
  let parsed: any;
  try {
    parsed = JSON.parse(m[1].trim());
  } catch (e) {
    fail(`Block #${i + 1} failed to parse: ${(e as Error).message}`);
  }
  if (parsed["@type"] === "FAQPage") faq = parsed;
}
if (!faq) fail("No FAQPage JSON-LD on /como-funciona");
if (!Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0)
  fail("FAQPage.mainEntity missing or empty");

const warnings: string[] = [];
for (const [i, q] of faq.mainEntity.entries()) {
  if (q["@type"] !== "Question") warnings.push(`mainEntity[${i}].@type !== Question`);
  if (!q.name || typeof q.name !== "string") warnings.push(`mainEntity[${i}].name missing`);
  if (!q.acceptedAnswer || q.acceptedAnswer["@type"] !== "Answer")
    warnings.push(`mainEntity[${i}].acceptedAnswer invalid`);
  if (!q.acceptedAnswer?.text) warnings.push(`mainEntity[${i}].acceptedAnswer.text missing`);
}
if (warnings.length) {
  console.error("  FAQ schema warnings:");
  for (const w of warnings) console.error(`    - ${w}`);
  process.exit(1);
}
ok(`FAQPage parses cleanly: ${faq.mainEntity.length} Q/A pairs, zero warnings`);

// 3. GSC site verification -----------------------------------------------------
log("Verifying site ownership in Google Search Console");
const verifyRes = await fetch(
  `${GATEWAY}/siteVerification/v1/webResource?verificationMethod=META`,
  {
    method: "POST",
    headers: gscHeaders,
    body: JSON.stringify({ site: { identifier: `${SITE}/`, type: "SITE" } }),
  },
);
const verifyBody = await verifyRes.text();
if (!verifyRes.ok) {
  console.error(`  GSC verify returned HTTP ${verifyRes.status}: ${verifyBody}`);
  if (verifyBody.includes("failedToFindMetaTag"))
    fail("Verification meta tag not live yet — republish and retry.");
  fail("Site verification failed");
}
ok("Site verified");

// 4. Add site to Search Console -----------------------------------------------
log("Adding site to Search Console property list");
const addRes = await fetch(`${GATEWAY}/webmasters/v3/sites/${SITE_ENCODED}`, {
  method: "PUT",
  headers: gscHeaders,
});
if (!addRes.ok && addRes.status !== 204) fail(`Add site HTTP ${addRes.status}: ${await addRes.text()}`);
ok(`Property added (HTTP ${addRes.status})`);

// 5. Submit sitemap ------------------------------------------------------------
log("Submitting sitemap.xml");
const smRes = await fetch(
  `${GATEWAY}/webmasters/v3/sites/${SITE_ENCODED}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`,
  { method: "PUT", headers: gscHeaders },
);
if (!smRes.ok && smRes.status !== 204) fail(`Sitemap submit HTTP ${smRes.status}: ${await smRes.text()}`);
ok(`Sitemap submitted (HTTP ${smRes.status})`);

// 6. Report any remaining sitemap-level issues from GSC ------------------------
log("Fetching sitemap status from Google");
const statusRes = await fetch(`${GATEWAY}/webmasters/v3/sites/${SITE_ENCODED}/sitemaps`, {
  headers: gscHeaders,
});
if (statusRes.ok) {
  const body = (await statusRes.json()) as any;
  for (const sm of body.sitemap ?? []) {
    const errs = Number(sm.errors ?? 0);
    const warns = Number(sm.warnings ?? 0);
    const tag = errs || warns ? "⚠" : "✓";
    console.log(`  ${tag} ${sm.path} — errors=${errs}, warnings=${warns}, submitted=${sm.lastSubmitted ?? "—"}`);
  }
} else {
  console.warn(`  (Could not fetch sitemap status: HTTP ${statusRes.status})`);
}

console.log("\n✅ Post-publish verification complete.\n");
