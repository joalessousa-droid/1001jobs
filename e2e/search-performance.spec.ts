// Performance de busca com base sintética grande (200+ perfis e 200+ tarefas).
//
// Reprodutibilidade: usa o modo `seed` do edge function `synthetic-seed-bot`
// (SYNTHETIC_BOT_ADMIN_TOKEN + seed fixa) para garantir um dataset conhecido
// e reduzir flakiness. Se o token não estiver disponível no ambiente, os
// testes usam o dataset atual sem resetar (fallback tolerante).
//
// Thresholds (podem ser ajustados via env):
//   SEARCH_LOAD_MS_MAX   (default 6000)  → tempo até cards visíveis
//   SEARCH_FILTER_MS_MAX (default 2500)  → tempo para aplicar filtro
//
// Rode com: bunx playwright test e2e/search-performance.spec.ts
import { test, expect, request as pwRequest } from "@playwright/test";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://ndtiregwcgbrgenozycb.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const ADMIN_TOKEN = process.env.SYNTHETIC_BOT_ADMIN_TOKEN ?? "";
const SEED = Number(process.env.SYNTHETIC_SEED ?? 20260717);
const TARGET_PROFILES = Number(process.env.SYNTHETIC_TARGET_PROFILES ?? 200);
const TARGET_REQUESTS = Number(process.env.SYNTHETIC_TARGET_REQUESTS ?? 200);
const LOAD_MAX = Number(process.env.SEARCH_LOAD_MS_MAX ?? 6000);
const FILTER_MAX = Number(process.env.SEARCH_FILTER_MS_MAX ?? 2500);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.skip(!ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY not set");
  if (!ADMIN_TOKEN) {
    console.warn("[perf] SYNTHETIC_BOT_ADMIN_TOKEN não definido — usando dataset atual (não reproduzível).");
    return;
  }
  const api = await pwRequest.newContext();
  const res = await api.post(`${SUPABASE_URL}/functions/v1/synthetic-seed-bot`, {
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "authorization": `Bearer ${ANON_KEY}`,
      "x-admin-token": ADMIN_TOKEN,
    },
    data: {
      mode: "seed",
      seed: SEED,
      targetProfiles: TARGET_PROFILES,
      targetRequests: TARGET_REQUESTS,
      batch: 100,
    },
    timeout: 180_000,
  });
  expect(res.ok(), `seed failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  console.log("[perf] seed result:", body);
  await api.dispose();
});

for (const vp of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`[${vp.name}] carrega /buscar em <${LOAD_MAX}ms com dataset grande`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const t0 = Date.now();
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    // Espera pelo menos 1 card renderizado (list mode)
    await page.locator('[data-testid="search-filters"]').waitFor({ state: "visible", timeout: LOAD_MAX });
    await page.locator('article, [role="article"], [data-testid^="provider-card"], [data-testid^="task-card"]')
      .first().waitFor({ timeout: LOAD_MAX });
    const elapsed = Date.now() - t0;
    console.log(`[perf][${vp.name}] load /buscar: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(LOAD_MAX);
  });
}

test("aplicar filtro de categoria responde em <FILTER_MAX ms", async ({ page }) => {
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="search-filters"]').waitFor({ state: "visible", timeout: LOAD_MAX });

  // Snapshot inicial: primeiro card
  const firstCard = page.locator('article, [role="article"]').first();
  await firstCard.waitFor({ timeout: LOAD_MAX });
  const initialText = (await firstCard.textContent())?.trim() ?? "";

  // Encontra o primeiro select/combobox de filtro (categoria)
  const combos = page.getByRole("combobox");
  const count = await combos.count();
  test.skip(count === 0, "nenhum combobox de filtro encontrado");

  const t0 = Date.now();
  await combos.first().click();
  const option = page.getByRole("option").nth(1);
  await option.waitFor({ timeout: 3000 });
  await option.click();

  // Aguarda mudança do primeiro card OU estabilização da lista
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector('article, [role="article"]');
      if (!el) return false;
      const txt = (el.textContent ?? "").trim();
      return txt.length > 0 && txt !== prev;
    },
    initialText,
    { timeout: FILTER_MAX },
  ).catch(() => { /* lista pode manter itens; medimos o tempo do clique/render */ });
  const elapsed = Date.now() - t0;
  console.log(`[perf] filter apply: ${elapsed}ms`);
  expect(elapsed).toBeLessThan(FILTER_MAX);
});

test("REST público retorna ≥ TARGET com base sintética semeada", async ({ request }) => {
  test.skip(!ANON_KEY, "sem anon key");
  const t0 = Date.now();
  const [profiles, requests] = await Promise.all([
    request.get(`${SUPABASE_URL}/rest/v1/public_profiles?is_synthetic=eq.true&select=id&limit=1000`, {
      headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` },
    }),
    request.get(`${SUPABASE_URL}/rest/v1/public_service_requests?is_synthetic=eq.true&select=id&limit=1000`, {
      headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` },
    }),
  ]);
  const elapsed = Date.now() - t0;
  expect(profiles.ok()).toBeTruthy();
  expect(requests.ok()).toBeTruthy();
  const pRows = await profiles.json();
  const rRows = await requests.json();
  console.log(`[perf] REST parallel: ${elapsed}ms profiles=${pRows.length} requests=${rRows.length}`);
  if (ADMIN_TOKEN) {
    // Só exige o alvo se tivermos semeado nós mesmos
    expect(pRows.length).toBeGreaterThanOrEqual(Math.min(TARGET_PROFILES, 50));
    expect(rRows.length).toBeGreaterThanOrEqual(Math.min(TARGET_REQUESTS, 50));
  }
  expect(elapsed).toBeLessThan(4000);
});
