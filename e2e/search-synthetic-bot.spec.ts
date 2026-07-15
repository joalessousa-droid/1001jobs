// E2E: valida que a busca e os filtros retornam tanto profissionais quanto
// tarefas sintéticos (bot interno) e que a regra de TTL de 30 dias é respeitada
// — nada expirado aparece nas views públicas consumidas pela busca.
import { test, expect, request as pwRequest } from "@playwright/test";

const APP_URL =
  process.env.APP_URL ?? "https://id-preview--93592dff-34d6-4932-8f07-ee563c8b63d5.lovable.app";
const SUPABASE_URL = "https://ndtiregwcgbrgenozycb.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kdGlyZWd3Y2dicmdlbm96eWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3Mjk0ODQsImV4cCI6MjA4NzMwNTQ4NH0.6YKKUKcy64O-JCoJATy5oxX0vGkzCMHkkipnCpyFdvA";

const restHeaders = {
  apikey: SUPABASE_ANON,
  Authorization: `Bearer ${SUPABASE_ANON}`,
  Prefer: "count=exact",
};

test.describe("@synthetic-bot-visibility", () => {
  test("REST público retorna profissionais sintéticos ativos", async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(
      `${SUPABASE_URL}/rest/v1/public_profiles?is_synthetic=eq.true&is_active=eq.true&select=id,display_name,city,is_synthetic&limit=25`,
      { headers: restHeaders },
    );
    expect(res.status(), await res.text()).toBe(200);
    const total = Number(res.headers()["content-range"]?.split("/").pop() ?? "0");
    expect(total).toBeGreaterThan(50);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.is_synthetic).toBe(true);
  });

  test("REST público retorna tarefas sintéticas ativas", async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(
      `${SUPABASE_URL}/rest/v1/public_service_requests?is_synthetic=eq.true&is_active=eq.true&select=id,description,category_id,is_synthetic&limit=25`,
      { headers: restHeaders },
    );
    expect(res.status(), await res.text()).toBe(200);
    const total = Number(res.headers()["content-range"]?.split("/").pop() ?? "0");
    expect(total).toBeGreaterThan(50);
    const rows = await res.json();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.is_synthetic).toBe(true);
  });

  test("regra 30 dias: base tables não expõem sintéticos expirados via REST", async () => {
    // A view pública só lista ativos; o cron apaga vencidos. Se algum aparecesse
    // aqui com created_at > 30 dias, seria violação da regra de TTL.
    const ctx = await pwRequest.newContext();
    const thirty = new Date(Date.now() - 30 * 86400_000).toISOString();
    for (const view of ["public_profiles", "public_service_requests"]) {
      const res = await ctx.get(
        `${SUPABASE_URL}/rest/v1/${view}?is_synthetic=eq.true&created_at=lt.${thirty}&select=id&limit=1`,
        { headers: restHeaders },
      );
      expect(res.status(), `${view}: ${await res.text()}`).toBe(200);
      const rows = await res.json();
      expect(rows, `${view} não deve conter sintético > 30 dias`).toEqual([]);
    }
  });
});

test.describe("@search-synthetic-ui", () => {
  test("modo profissionais exibe cards com selo Demo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${APP_URL}/buscar?mode=provider&view=list&radius=200`);
    await expect(page.getByTestId("search-filters-bar")).toBeVisible({ timeout: 15_000 });
    // Aguarda pelo menos um card com selo Demo (bot interno).
    const demo = page.locator('span[title="Perfil de demonstração"], span[title*="demonstra"]').first();
    await expect(demo).toBeVisible({ timeout: 20_000 });
    const count = await page
      .locator('span[title*="demonstra"], span:has-text("Demo")')
      .count();
    expect(count).toBeGreaterThan(0);
  });

  test("modo tarefas exibe cards com selo Demo mesmo com filtros", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${APP_URL}/buscar?mode=task&view=list&category=all&radius=200`);
    await expect(page.getByTestId("search-filters-bar")).toBeVisible({ timeout: 15_000 });
    const demo = page.locator('span:has-text("Demo")').first();
    await expect(demo).toBeVisible({ timeout: 20_000 });
  });

  test("filtro por cidade mantém resultados sintéticos", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `${APP_URL}/buscar?mode=provider&view=list&city=S%C3%A3o%20Paulo&radius=200`,
    );
    await expect(page.getByTestId("search-filters-bar")).toBeVisible({ timeout: 15_000 });
    // Deve haver ao menos um Demo em São Paulo (bot semeia todas capitais).
    await expect(page.locator('span:has-text("Demo")').first()).toBeVisible({ timeout: 20_000 });
  });
});
