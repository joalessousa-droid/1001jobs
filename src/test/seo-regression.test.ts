/**
 * SEO regression test — runs as part of `npm test` on every CI/deploy.
 * Validates sitemap, robots, JSON-LD, and core head tags so accidental
 * deletions or template resets get caught before publish.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve } from "path";

describe("SEO regression", () => {
  it("passes the static SEO regression check", () => {
    const script = resolve("scripts/seo-regression-check.ts");
    expect(() => {
      execSync(`npx tsx ${script}`, { stdio: "pipe" });
    }).not.toThrow();
  });
});
