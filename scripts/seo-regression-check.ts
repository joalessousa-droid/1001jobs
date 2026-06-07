/**
 * SEO regression check — runs on `prebuild` (and on demand).
 * Validates sitemap.xml structure, presence of required JSON-LD blocks,
 * and key Lighthouse-relevant static head tags (title, description,
 * canonical, viewport, og:*). Fails the build on regressions.
 *
 * For live Lighthouse audits against the deployed URL, run:
 *   npx lighthouse https://jobs1001.lovable.app/como-funciona \
 *     --only-categories=seo,performance,accessibility --quiet
 *   npx lighthouse https://jobs1001.lovable.app/buscar \
 *     --only-categories=seo,performance,accessibility --quiet
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const errors: string[] = [];
const warn = (msg: string) => errors.push(msg);

// ---- sitemap.xml ----
const sitemapPath = resolve("public/sitemap.xml");
if (!existsSync(sitemapPath)) {
  warn("public/sitemap.xml is missing");
} else {
  const xml = readFileSync(sitemapPath, "utf8");
  if (!xml.includes("<urlset")) warn("sitemap.xml missing <urlset>");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) warn("sitemap.xml has no <loc> entries");
  for (const loc of locs) {
    if (!/^https?:\/\//.test(loc)) warn(`sitemap.xml has non-absolute loc: ${loc}`);
  }
  const required = ["/", "/buscar", "/como-funciona"];
  for (const path of required) {
    if (!locs.some((l) => l.endsWith(path) || l.endsWith(path + "/"))) {
      warn(`sitemap.xml missing required route: ${path}`);
    }
  }
}

// ---- robots.txt ----
const robotsPath = resolve("public/robots.txt");
if (!existsSync(robotsPath)) {
  warn("public/robots.txt is missing");
} else {
  const robots = readFileSync(robotsPath, "utf8");
  if (!/Sitemap:\s*https?:\/\//i.test(robots)) warn("robots.txt missing Sitemap: directive");
  if (/^\s*Disallow:\s*\/\s*$/m.test(robots) && !/Allow:/i.test(robots))
    warn("robots.txt appears to block the whole site");
}

// ---- index.html head ----
const indexPath = resolve("index.html");
const html = readFileSync(indexPath, "utf8");
const checks: Array<[RegExp, string]> = [
  [/<title>[^<]{10,}<\/title>/, "missing or too-short <title>"],
  [/<meta\s+name=["']description["']\s+content=["'][^"']{50,}["']/, "missing or too-short meta description"],
  [/<link\s+rel=["']canonical["']\s+href=["']https?:\/\//, "missing canonical link"],
  [/<meta\s+name=["']viewport["']/, "missing viewport meta"],
  [/<meta\s+property=["']og:title["']/, "missing og:title"],
  [/<meta\s+property=["']og:description["']/, "missing og:description"],
  [/<meta\s+property=["']og:url["']/, "missing og:url"],
  [/<meta\s+name=["']google-site-verification["']/, "missing Google Search Console verification meta"],
];
for (const [rx, msg] of checks) if (!rx.test(html)) warn(`index.html ${msg}`);

// ---- JSON-LD blocks (sitewide + per-route source check) ----
const jsonLdBlocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
if (jsonLdBlocks.length < 2) warn("index.html should ship at least Organization + WebSite JSON-LD");
for (const [, body] of jsonLdBlocks) {
  try {
    JSON.parse(body);
  } catch {
    warn("index.html contains invalid JSON-LD");
  }
}

// HowItWorks FAQPage JSON-LD lives in src/pages/HowItWorksPage.tsx
const faqSrc = readFileSync(resolve("src/pages/HowItWorksPage.tsx"), "utf8");
if (!faqSrc.includes('"@type": "FAQPage"') && !faqSrc.includes('"@type":"FAQPage"')) {
  warn("HowItWorksPage.tsx missing FAQPage JSON-LD");
}
if (!faqSrc.includes('"mainEntity"')) {
  warn("HowItWorksPage.tsx FAQPage JSON-LD missing mainEntity");
}

if (errors.length) {
  console.error("\n[seo-regression] FAILED:\n" + errors.map((e) => "  - " + e).join("\n") + "\n");
  process.exit(1);
}
console.log(`[seo-regression] OK — ${jsonLdBlocks.length} JSON-LD blocks, sitemap + robots + head valid.`);
