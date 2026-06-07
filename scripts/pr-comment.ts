#!/usr/bin/env -S npx tsx
/**
 * Posts (or updates) a sticky comment on the current Pull Request summarizing
 * the post-publish SEO/Lighthouse run. Includes:
 *   - FAQ JSON-LD status (questions, warnings)
 *   - Canonical / robots / sitemap step results
 *   - Lighthouse scores per path
 *   - Links to the uploaded artifact (report, screenshots, snapshot)
 *   - Reference to the GitHub issue opened on failure (if any)
 *
 * Required env (provided by GitHub Actions):
 *   GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH, GITHUB_RUN_ID,
 *   GITHUB_SERVER_URL, GITHUB_REF_NAME
 * Optional:
 *   ARTIFACT_NAME           Name of uploaded artifact (default: seo-report-<ref>-<runId>)
 *   FAILURE_ISSUE_NUMBER    Issue # opened by open-github-issue.ts (if any)
 */
import { existsSync, readFileSync } from "fs";
import { resolve, join } from "path";

const {
  GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH,
  GITHUB_RUN_ID, GITHUB_SERVER_URL = "https://github.com",
  GITHUB_REF_NAME = "", ARTIFACT_NAME, FAILURE_ISSUE_NUMBER,
} = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !GITHUB_EVENT_PATH) {
  console.log("Not running in PR context — skipping PR comment.");
  process.exit(0);
}

const event = JSON.parse(readFileSync(GITHUB_EVENT_PATH, "utf8"));
const prNumber: number | undefined = event.pull_request?.number;
if (!prNumber) {
  console.log("No pull_request in event payload — skipping PR comment.");
  process.exit(0);
}

const REPORT_DIR = resolve(process.env.REPORT_DIR || "./reports");
const readJson = (p: string) => existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
const summary = readJson(join(REPORT_DIR, "post-publish-summary.json"));
const lh = readJson(join(REPORT_DIR, "lighthouse-summary.json"));
const history = readJson(join(REPORT_DIR, "rich-results-history.json"));
const last = history?.entries?.[history.entries.length - 1];

const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
const artifactName = ARTIFACT_NAME || `seo-report-${GITHUB_REF_NAME}-${GITHUB_RUN_ID}`;
const artifactsUrl = `${runUrl}#artifacts`;

const STICKY = "<!-- lovable-seo-pr-comment -->";
const icon = (ok: boolean) => (ok ? "✅" : "❌");

const stepRow = (name: string) => {
  const s = summary?.steps?.find((x: any) => x.name === name);
  if (!s) return `| ${name} | — | not run |`;
  return `| ${name} | ${icon(s.ok)} | ${String(s.detail).slice(0, 140)} |`;
};

const lhRows = Array.isArray(lh?.results) && lh.results.length
  ? lh.results.map((r: any) =>
      `| \`${r.url}\` | ${Math.round((r.scores?.performance ?? 0) * 100)} | ${Math.round((r.scores?.accessibility ?? 0) * 100)} | ${Math.round((r.scores?.seo ?? 0) * 100)} | ${r.ok ? "✅" : "❌"} |`,
    ).join("\n")
  : "| — | — | — | — | — |";

const faq = summary?.faq;
const overallOk = !!summary?.ok && !lh?.failed;

const body = `${STICKY}
## ${icon(overallOk)} Post-deploy SEO / Lighthouse — \`${GITHUB_REF_NAME}\`

**Site:** ${summary?.site ?? "—"}
**Run:** [#${GITHUB_RUN_ID}](${runUrl}) · **Artifacts:** [${artifactName}](${artifactsUrl})

### FAQ JSON-LD
- Status: ${faq?.found ? (faq.warnings?.length ? "⚠ warnings" : "✅ valid") : "❌ missing"}
- Questions: ${faq?.questions ?? 0} · Warnings: ${faq?.warnings?.length ?? 0}
${faq?.warnings?.length ? faq.warnings.map((w: string) => `  - ${w}`).join("\n") : ""}

### Post-publish checks
| Step | OK | Detail |
|---|---|---|
${["fetch_faq_page","json_ld_parse","faq_present","canonical_consistency","robots_consistency","sitemap_reachable","gsc_verify","gsc_add_site","gsc_sitemap_submit","gsc_sitemap_consistency"].map(stepRow).join("\n")}

### Lighthouse
| URL | Performance | Accessibility | SEO | OK |
|---|---|---|---|---|
${lhRows}

### Rich Results snapshot
- Status: **${last?.status ?? "—"}** · Sitemap errors: ${last?.sitemap?.errors ?? 0}
${last?.regression?.newWarnings?.length ? `- ⚠ New warnings: ${last.regression.newWarnings.join("; ")}` : ""}
${last?.regression?.resolvedWarnings?.length ? `- ✓ Resolved: ${last.regression.resolvedWarnings.join("; ")}` : ""}

${FAILURE_ISSUE_NUMBER ? `### 🐛 Tracking issue\nSee #${FAILURE_ISSUE_NUMBER} for the full failure report.` : ""}

_Updated automatically by \`scripts/pr-comment.ts\`._
`;

// Find existing sticky comment
const api = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
};

const listRes = await fetch(`${api}/issues/${prNumber}/comments?per_page=100`, { headers });
const comments = listRes.ok ? (await listRes.json() as any[]) : [];
const existing = comments.find((c) => typeof c.body === "string" && c.body.includes(STICKY));

const method = existing ? "PATCH" : "POST";
const url = existing ? `${api}/issues/comments/${existing.id}` : `${api}/issues/${prNumber}/comments`;
const res = await fetch(url, { method, headers, body: JSON.stringify({ body }) });

if (!res.ok) {
  console.error(`Failed to ${method} PR comment: HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`✓ PR comment ${existing ? "updated" : "created"} on #${prNumber}`);
