// E2E: snapshots visuais da faixa header+filtros sticky em /buscar.
// Captura recortes determinísticos (apenas o header sticky + a faixa de filtros
// imediatamente abaixo) nas variações críticas para detectar regressões de
// sobreposição rapidamente.
//
// Atualizar baselines: `npx playwright test e2e/search-sticky-snapshots.spec.ts --update-snapshots`
import { test, expect } from "@playwright/test";

const APP_URL = process.env.APP_URL ?? "https://id-preview--93592dff-34d6-4932-8f07-ee563c8b63d5.lovable.app";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const SEL = "857f87ab-5804-44f3-b0ee-0c09700024c8";

// Variações críticas (subconjunto do spec funcional): sem seleção, com sel em
// list e map, e modo provider — cobrem os layouts onde a sobreposição apareceu
// historicamente.
const CRITICAL_ROUTES = [
  { name: "sem-selecao", path: "/buscar" },
  { name: "com-sel-list", path: `/buscar?sel=${SEL}&view=list&radius=25` },
  { name: "com-sel-map", path: `/buscar?sel=${SEL}&view=map&radius=25` },
  { name: "mode-provider", path: `/buscar?sel=${SEL}&mode=provider&view=list&radius=25` },
  // Mapa sem ?sel — sticky filter precisa ficar acima do mapa em todos os
  // breakpoints (regressão histórica: filtro era shrink em view=map).
  { name: "mapa-puro", path: `/buscar?view=map&radius=25` },
  // Filtros agressivos: garante que combos longos não quebram o layout
  { name: "filtros-agressivos", path: `/buscar?q=eletricista&city=Curitiba&radius=200&view=list` },
];

test.describe("@search-sticky-snapshots", () => {
  test.describe.configure({ mode: "parallel" });

  for (const vp of VIEWPORTS) {
    for (const route of CRITICAL_ROUTES) {
      test(`snapshot sticky — ${vp.name} ${route.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${APP_URL}${route.path}`);

        const header = page.getByTestId("search-sticky-header");
        const filters = page.getByTestId("search-filters-bar");
        await expect(header).toBeVisible({ timeout: 15_000 });
        const filtersVisible = await filters.isVisible().catch(() => false);
        test.skip(!filtersVisible, "Filtros não renderizados (provável tela de auth)");

        // Mascara conteúdos voláteis (mapa, avatares, contadores dinâmicos)
        // para que o snapshot só falhe por regressão de layout/sobreposição.
        const masks = [
          page.locator(".leaflet-container"),
          page.locator("img"),
          page.locator("[data-testid='match-score']"),
        ];

        // Calcula a região exata que cobre header sticky + faixa de filtros.
        const hb = await header.boundingBox();
        const fb = await filters.boundingBox();
        if (!hb || !fb) throw new Error("Bounding boxes indisponíveis");
        const clip = {
          x: 0,
          y: Math.max(0, hb.y),
          width: vp.width,
          height: Math.max(hb.height + fb.height + 24, fb.y + fb.height - hb.y + 8),
        };

        await expect(page).toHaveScreenshot(
          `${vp.name}-${route.name}-initial.png`,
          {
            clip,
            mask: masks,
            maxDiffPixelRatio: 0.02,
            animations: "disabled",
            caret: "hide",
          },
        );

        // Após scroll: ambos devem permanecer pinados e sem sobreposição.
        await page.mouse.wheel(0, 1200);
        await page.waitForTimeout(400);

        const hb2 = await header.boundingBox();
        const fb2 = await filters.boundingBox();
        if (!hb2 || !fb2) return;
        const clip2 = {
          x: 0,
          y: Math.max(0, hb2.y),
          width: vp.width,
          height: Math.max(hb2.height + fb2.height + 24, fb2.y + fb2.height - hb2.y + 8),
        };

        await expect(page).toHaveScreenshot(
          `${vp.name}-${route.name}-scrolled.png`,
          {
            clip: clip2,
            mask: masks,
            maxDiffPixelRatio: 0.02,
            animations: "disabled",
            caret: "hide",
          },
        );
      });
    }
  }
});
