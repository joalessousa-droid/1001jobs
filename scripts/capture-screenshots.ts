#!/usr/bin/env -S npx tsx
/**
 * Captures full-page screenshots of audited URLs for visual audit attachments.
 *
 * Config (env, all optional):
 *   LH_BASE_URL   Base origin. Default https://jobs1001.lovable.app
 *   LH_PATHS      Comma-separated paths. Default /como-funciona,/buscar
 *   LH_URLS       Comma-separated full URLs (overrides LH_PATHS).
 *   SCREENSHOT_DIR  Output dir. Default ./reports/screenshots
 *   SCREENSHOT_WIDTH  Viewport width. Default 1366
 */
import puppeteer from "puppeteer";
import { mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const BASE = (process.env.LH_BASE_URL || "https://jobs1001.lovable.app").replace(/\/$/, "");
const URLS = (process.env.LH_URLS
  ? process.env.LH_URLS.split(",")
  : (process.env.LH_PATHS || "/como-funciona,/buscar").split(",").map((p) => BASE + p.trim())
).map((u) => u.trim()).filter(Boolean);

const OUT = resolve(process.env.SCREENSHOT_DIR || "./reports/screenshots");
const WIDTH = Number(process.env.SCREENSHOT_WIDTH || 1366);
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const manifest: Array<{ url: string; file: string; ok: boolean; error?: string }> = [];

for (const url of URLS) {
  const safe = url.replace(/[^a-z0-9]+/gi, "_");
  const file = join(OUT, `${safe}.png`);
  console.log(`▸ Screenshot: ${url}`);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
    await page.screenshot({ path: file, fullPage: true });
    await page.close();
    manifest.push({ url, file, ok: true });
    console.log(`  ✓ ${file}`);
  } catch (e) {
    manifest.push({ url, file, ok: false, error: (e as Error).message });
    console.error(`  ✗ ${(e as Error).message}`);
  }
}

await browser.close();
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), shots: manifest }, null, 2));
if (manifest.some((m) => !m.ok)) process.exit(1);
