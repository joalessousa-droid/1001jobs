#!/usr/bin/env -S npx tsx
/**
 * Aggregates ./reports/post-publish-summary.json +
 * ./reports/lighthouse-summary.json into:
 *
 *   ./reports/seo-report.md
 *   ./reports/seo-report.html
 *
 * Both files are uploaded as CI artifacts (see GitHub workflow).
 * Includes links to Google Rich Results test for the FAQ URL.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const DIR = resolve(process.env.REPORT_DIR || "./reports");
const pp = existsSync(join(DIR, "post-publish-summary.json"))
  ? JSON.parse(readFileSync(join(DIR, "post-publish-summary.json"), "utf8")) : null;
const lh = existsSync(join(DIR, "lighthouse-summary.json"))
  ? JSON.parse(readFileSync(join(DIR, "lighthouse-summary.json"), "utf8")) : null;

const richResultsUrl = (u: string) =>
  `https://search.google.com/test/rich-results?url=${encodeURIComponent(u)}`;
const tick = (b: boolean) => (b ? "✅" : "❌");

let md = `# SEO Post-Deploy Report\n\nGenerated: ${new Date().toISOString()}\n\n`;

if (pp) {
  md += `## FAQ JSON-LD — ${pp.faqUrl}\n\n`;
  md += `- Status: ${tick(pp.faq.found && pp.faq.warnings.length === 0)}\n`;
  md += `- Questions: ${pp.faq.questions}\n`;
  md += `- Warnings: ${pp.faq.warnings.length}\n`;
  if (pp.faq.warnings.length) md += pp.faq.warnings.map((w: string) => `  - ${w}`).join("\n") + "\n";
  md += `- [Open in Google Rich Results test](${richResultsUrl(pp.faqUrl)})\n\n`;

  md += `## Post-publish steps\n\n| Step | OK | Detail |\n|---|---|---|\n`;
  for (const s of pp.steps) md += `| ${s.name} | ${tick(s.ok)} | ${s.detail.replace(/\|/g, "\\|")} |\n`;
  md += `\n`;

  if (pp.sitemapStatus?.length) {
    md += `## GSC sitemap status\n\n| Sitemap | Errors | Warnings | Last submitted |\n|---|---|---|---|\n`;
    for (const sm of pp.sitemapStatus) md += `| ${sm.path} | ${sm.errors ?? 0} | ${sm.warnings ?? 0} | ${sm.lastSubmitted ?? "—"} |\n`;
    md += `\n`;
  }
}

if (lh) {
  md += `## Lighthouse\n\nThresholds: perf ≥ ${lh.thresholds.performance}, a11y ≥ ${lh.thresholds.accessibility}, SEO ≥ ${lh.thresholds.seo}\n\n`;
  md += `| URL | Performance | Accessibility | SEO | OK |\n|---|---|---|---|---|\n`;
  for (const r of lh.results) {
    const pct = (k: string) => r.scores?.[k] != null ? Math.round(r.scores[k] * 100) : "—";
    md += `| [${r.url}](${r.url}) | ${pct("performance")} | ${pct("accessibility")} | ${pct("seo")} | ${tick(r.ok)} |\n`;
  }
  md += `\n`;
  const failed = lh.results.filter((r: any) => !r.ok);
  if (failed.length) {
    md += `### Failures\n\n`;
    for (const r of failed) for (const f of r.failures) md += `- ${r.url}: ${f}\n`;
  }
}

writeFileSync(join(DIR, "seo-report.md"), md);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>SEO Report</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#111;background:#fafafa}
table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #ddd;padding:.5rem .75rem;text-align:left}
th{background:#eee}h1,h2,h3{font-family:inherit}code{background:#eee;padding:.1em .3em;border-radius:3px}</style>
</head><body>${
  md.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\| (.*) \|$/gm, (line) => {
      const cells = line.slice(2, -2).split(" | ");
      const isSep = cells.every((c) => /^[-:]+$/.test(c.trim()));
      if (isSep) return "";
      return "<tr>" + cells.map((c) => `<td>${c}</td>`).join("") + "</tr>";
    })
    .replace(/(<tr>(?:(?!<\/?table).)+?<\/tr>(?:\s*<tr>(?:(?!<\/?table).)+?<\/tr>)+)/gs, "<table>$1</table>")
    .replace(/\n/g, "<br/>")
}</body></html>`;
writeFileSync(join(DIR, "seo-report.html"), html);

console.log(`Wrote ${join(DIR, "seo-report.md")} and seo-report.html`);
