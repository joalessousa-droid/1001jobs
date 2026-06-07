#!/usr/bin/env -S npx tsx
/**
 * Sends a failure notification to Slack and/or email when the CI
 * SEO/Lighthouse checks fail or when GSC reports errors/warnings.
 *
 * Configuration:
 *   SLACK_WEBHOOK_URL   Slack Incoming Webhook URL (optional)
 *   ALERT_EMAIL_TO      Recipient address for email notifications (optional)
 *   ALERT_EMAIL_FROM    Sender for the email (defaults to alerts@jobs1001.com)
 *   RESEND_API_KEY      Resend API key (required if ALERT_EMAIL_TO is set)
 *   GITHUB_RUN_URL      Link back to the failing CI run (optional)
 *
 * Reads ./reports/post-publish-summary.json and lighthouse-summary.json,
 * builds a digest, and dispatches via configured channels. Silently
 * skips channels that aren't configured.
 */
import { existsSync, readFileSync } from "fs";
import { resolve, join } from "path";

const DIR = resolve(process.env.REPORT_DIR || "./reports");
const pp = existsSync(join(DIR, "post-publish-summary.json"))
  ? JSON.parse(readFileSync(join(DIR, "post-publish-summary.json"), "utf8")) : null;
const lh = existsSync(join(DIR, "lighthouse-summary.json"))
  ? JSON.parse(readFileSync(join(DIR, "lighthouse-summary.json"), "utf8")) : null;

const failures: string[] = [];
if (pp && !pp.ok) {
  for (const s of pp.steps) if (!s.ok) failures.push(`[post-publish] ${s.name}: ${s.detail}`);
}
if (lh && !lh.ok) {
  for (const r of lh.results) for (const f of r.failures) failures.push(`[lighthouse] ${r.url}: ${f}`);
}
// GSC warnings/errors even on otherwise-ok runs
if (pp?.sitemapStatus) {
  for (const sm of pp.sitemapStatus) {
    const e = Number(sm.errors ?? 0), w = Number(sm.warnings ?? 0);
    if (e || w) failures.push(`[gsc-sitemap] ${sm.path}: errors=${e} warnings=${w}`);
  }
}

if (failures.length === 0) {
  console.log("No failures to notify.");
  process.exit(0);
}

const runUrl = process.env.GITHUB_RUN_URL;
const title = `1001Jobs SEO CI: ${failures.length} issue(s)`;
const body = failures.map((f) => "• " + f).join("\n") + (runUrl ? `\n\nRun: ${runUrl}` : "");

let sent = false;

// Slack ---------------------------------------------------------------------
if (process.env.SLACK_WEBHOOK_URL) {
  const r = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `*${title}*\n${body}` }),
  });
  console.log(`Slack: HTTP ${r.status}`);
  sent = true;
}

// Email via Resend ----------------------------------------------------------
if (process.env.ALERT_EMAIL_TO && process.env.RESEND_API_KEY) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM || "alerts@jobs1001.com",
      to: process.env.ALERT_EMAIL_TO,
      subject: title,
      text: body,
    }),
  });
  console.log(`Email: HTTP ${r.status}`);
  sent = true;
}

if (!sent) console.log("No notification channels configured (set SLACK_WEBHOOK_URL or ALERT_EMAIL_TO+RESEND_API_KEY).");
