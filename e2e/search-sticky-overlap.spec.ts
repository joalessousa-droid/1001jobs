// E2E: garante que header/filtros sticky, mapa e detalhe nunca se sobreponham
// na página /buscar — incluindo variantes com ?sel=, filtros agressivos,
// alternância list ↔ map, e a página de detalhe pública do prestador.
import { test, expect, type Page } from "@playwright/test";

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
  { name: "com-sel-category", path: `/buscar?sel=${SEL}&view=list&category=all&radius=10` },
  {
    name: "com-sel-query-city",
    path: `/buscar?sel=${SEL}&view=list&q=encanador&city=S%C3%A3o%20Paulo&radius=50`,
  },
  { name: "com-sel-mode-provider", path: `/buscar?sel=${SEL}&mode=provider&view=list&radius=25` },
  {
    name: "com-sel-map-filtros",
    path: `/buscar?sel=${SEL}&view=map&q=limpeza&city=Campinas&radius=5`,
  },
  // Filtros agressivos sem ?sel (todos combinados)
  {
    name: "filtros-agressivos",
    path: `/buscar?q=eletricista&city=Curitiba&category=all&radius=200&view=list`,
  },
];

async function noOverlap(page: Page, topTestId: string, bottomTestId: string) {
  const top = page.getByTestId(topTestId);
  const bottom = page.getByTestId(bottomTestId);
  await expect(top).toBeVisible({ timeout: 15_000 });
  const bottomVisible = await bottom.isVisible().catch(() => false);
  test.skip(!bottomVisible, `${bottomTestId} não renderizado (auth/empty)`);

  const check = async () => {
    const tb = await top.boundingBox();
    const bb = await bottom.boundingBox();
    expect(tb, `${topTestId} bounding box`).not.toBeNull();
    expect(bb, `${bottomTestId} bounding box`).not.toBeNull();
    if (!tb || !bb) return;
    expect(bb.y + 1).toBeGreaterThanOrEqual(tb.y + tb.height);
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
      test(`busca: header não sobrepõe filtros — ${vp.name} ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${APP_URL}${route.path}`);
        await noOverlap(page, "search-sticky-header", "search-filters-bar");
      });
    }
  }
});

test.describe("@search-map-no-overlap", () => {
  // Mapa nunca pode subir atrás do filtro (regressão observada quando o
  // filtro era flex-shrink em view=map e a hint do raio era clipada).
  for (const vp of VIEWPORTS) {
    const mapRoutes = [
      { name: "mapa-puro", path: `/buscar?view=map&radius=25` },
      { name: "mapa-com-sel", path: `/buscar?sel=${SEL}&view=map&radius=25` },
      { name: "mapa-filtros", path: `/buscar?view=map&q=limpeza&radius=5&category=all` },
    ];
    for (const route of mapRoutes) {
      test(`mapa fica abaixo do filtro — ${vp.name} ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${APP_URL}${route.path}`);
        await noOverlap(page, "search-filters-bar", "search-map-container");
      });
    }
  }
});

test.describe("@search-detail-no-pushes-layout", () => {
  // Em desktop o painel de detalhe não pode empurrar/encolher a coluna da
  // esquerda nem subir atrás do header sticky.
  const DESKTOP_VPS = VIEWPORTS.filter((v) => v.name === "desktop" || v.name === "tablet");
  for (const vp of DESKTOP_VPS) {
    test(`detalhe não empurra layout — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${APP_URL}/buscar?sel=${SEL}&view=list&radius=25`);

      const header = page.getByTestId("search-sticky-header");
      const filters = page.getByTestId("search-filters-bar");
      const detail = page.getByTestId("search-detail-panel");

      await expect(header).toBeVisible({ timeout: 15_000 });
      const detailVisible = await detail.isVisible().catch(() => false);
      test.skip(!detailVisible, "Detalhe não renderizado (mobile sheet ou empty)");

      const hb = await header.boundingBox();
      const fb = await filters.boundingBox();
      const db = await detail.boundingBox();
      if (!hb || !fb || !db) return;

      // Detalhe começa abaixo do header sticky
      expect(db.y + 1).toBeGreaterThanOrEqual(hb.y + hb.height);
      // Detalhe e filtros não colidem horizontalmente: detalhe está à direita
      expect(db.x).toBeGreaterThanOrEqual(fb.x + fb.width - 1);
      // Detalhe não excede a viewport
      expect(db.x + db.width).toBeLessThanOrEqual(vp.width + 1);
    });
  }
});

test.describe("@search-view-toggle", () => {
  // Alternar list ↔ map várias vezes não deve produzir overlap em nenhum estado.
  for (const vp of VIEWPORTS) {
    test(`alternância list ↔ map mantém layout — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${APP_URL}/buscar?sel=${SEL}&view=list&radius=25`);

      const header = page.getByTestId("search-sticky-header");
      const filters = page.getByTestId("search-filters-bar");
      await expect(header).toBeVisible({ timeout: 15_000 });
      const filtersVisible = await filters.isVisible().catch(() => false);
      test.skip(!filtersVisible, "Filtros não renderizados");

      const assertNoOverlapNow = async () => {
        const hb = await header.boundingBox();
        const fb = await filters.boundingBox();
        if (!hb || !fb) return;
        expect(fb.y + 1).toBeGreaterThanOrEqual(hb.y + hb.height);
        // Se o mapa está visível, verifica também
        const map = page.getByTestId("search-map-container");
        if (await map.isVisible().catch(() => false)) {
          const mb = await map.boundingBox();
          if (mb) expect(mb.y + 1).toBeGreaterThanOrEqual(fb.y + fb.height);
        }
      };

      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: /^Mapa$/ }).click();
        await page.waitForTimeout(350);
        await assertNoOverlapNow();
        await page.getByRole("button", { name: /^Lista$/ }).click();
        await page.waitForTimeout(350);
        await assertNoOverlapNow();
      }
    });
  }
});

test.describe("@provider-profile-sticky", () => {
  for (const vp of VIEWPORTS) {
    test(`perfil do prestador: tabs sticky permanecem no topo — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${APP_URL}/prestador/${SEL}`);

      const tabs = page.getByTestId("provider-profile-tabs");
      const visible = await tabs.isVisible({ timeout: 15_000 }).catch(() => false);
      test.skip(!visible, "Tabs do perfil não renderizadas (provider não encontrado)");

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
