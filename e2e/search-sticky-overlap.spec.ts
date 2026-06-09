// E2E: garante que a faixa de filtros nunca fique sobreposta pelo header sticky
// na página /buscar — incluindo variantes com ?sel=, filtros aplicados (category,
// q, city, view=list/map, mode=provider) e a página de detalhe pública do
// prestador (/prestador/:id) — em mobile, tablet e desktop.
import { test, expect } from "@playwright/test";

const APP_URL = process.env.APP_URL ?? "https://id-preview--93592dff-34d6-4932-8f07-ee563c8b63d5.lovable.app";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const SEL = "857f87ab-5804-44f3-b0ee-0c09700024c8";

const SEARCH_ROUTES = [
  { name: "sem-selecao", path: "/buscar" },
  { name: "com-sel-list", path: `/buscar?sel=${SEL}&view=list&radius=25` },
  { name: "com-sel-map", path: `/buscar?sel=${SEL}&view=map&radius=25` },
  // Detalhe + filtro de categoria
  { name: "com-sel-category", path: `/buscar?sel=${SEL}&view=list&category=all&radius=10` },
  // Detalhe + busca textual + cidade
  {
    name: "com-sel-query-city",
    path: `/buscar?sel=${SEL}&view=list&q=encanador&city=S%C3%A3o%20Paulo&radius=50`,
  },
  // Modo prestador (Tarefas) com seleção
  { name: "com-sel-mode-provider", path: `/buscar?sel=${SEL}&mode=provider&view=list&radius=25` },
  // Map + filtros agressivos
  {
    name: "com-sel-map-filtros",
    path: `/buscar?sel=${SEL}&view=map&q=limpeza&city=Campinas&radius=5`,
  },
];

async function assertNoOverlap(
  page: import("@playwright/test").Page,
  headerSelector: string,
  belowSelector: string,
) {
  const header = page.getByTestId(headerSelector);
  const below = page.getByTestId(belowSelector);

  await expect(header).toBeVisible({ timeout: 15_000 });
  const belowVisible = await below.isVisible().catch(() => false);
  test.skip(!belowVisible, `Elemento ${belowSelector} não renderizado (auth/empty state)`);

  const check = async () => {
    const hb = await header.boundingBox();
    const fb = await below.boundingBox();
    expect(hb, "header bounding box").not.toBeNull();
    expect(fb, "below bounding box").not.toBeNull();
    if (!hb || !fb) return;
    // Tolerância de 1px para arredondamento subpixel
    expect(fb.y + 1).toBeGreaterThanOrEqual(hb.y + hb.height);
  };

  await check();
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(300);
  await check();
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(300);
  await check();
}

test.describe("@search-sticky", () => {
  for (const vp of VIEWPORTS) {
    for (const route of SEARCH_ROUTES) {
      test(`busca: filtros não sobrepostos — ${vp.name} ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${APP_URL}${route.path}`);
        await assertNoOverlap(page, "search-sticky-header", "search-filters-bar");
      });
    }
  }
});

test.describe("@provider-profile-sticky", () => {
  for (const vp of VIEWPORTS) {
    test(`perfil do prestador: tabs sticky permanecem no topo — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${APP_URL}/prestador/${SEL}`);

      const tabs = page.getByTestId("provider-profile-tabs");
      const visible = await tabs.isVisible({ timeout: 15_000 }).catch(() => false);
      // Se o prestador não existir, a página exibe um estado vazio — pula.
      test.skip(!visible, "Tabs do perfil não renderizadas (provider não encontrado)");

      // Após scroll, as tabs devem permanecer ancoradas em y >= 0
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(300);
      const box = await tabs.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.y).toBeGreaterThanOrEqual(-1);
        expect(box.y).toBeLessThan(vp.height / 2);
      }
    });
  }
});
