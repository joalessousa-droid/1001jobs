// E2E: garante que a faixa de filtros nunca fique sobreposta pelo header sticky
// na página /buscar — incluindo carregamento com ?sel= preenchido — em mobile,
// tablet e desktop.
import { test, expect, devices } from "@playwright/test";

const APP_URL = process.env.APP_URL ?? "https://id-preview--93592dff-34d6-4932-8f07-ee563c8b63d5.lovable.app";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const ROUTES = [
  { name: "sem-selecao", path: "/buscar" },
  // Carrega com ?sel= preenchido (id arbitrário; backend pode não encontrar,
  // mas o layout sticky deve permanecer íntegro).
  { name: "com-sel", path: "/buscar?sel=857f87ab-5804-44f3-b0ee-0c09700024c8&view=list&radius=25" },
  { name: "com-sel-map", path: "/buscar?sel=857f87ab-5804-44f3-b0ee-0c09700024c8&view=map&radius=25" },
];

test.describe("@search-sticky", () => {
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`filtros não sobrepostos — ${vp.name} ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${APP_URL}${route.path}`);

        const header = page.getByTestId("search-sticky-header");
        const filters = page.getByTestId("search-filters-bar");

        await expect(header).toBeVisible({ timeout: 15_000 });
        // A faixa de filtros existe somente quando a página de busca está
        // renderizada (usuário autenticado). Pulamos quando não encontrada.
        const filtersVisible = await filters.isVisible().catch(() => false);
        test.skip(!filtersVisible, "Filtros não renderizados (provável tela de auth)");

        const hb = await header.boundingBox();
        const fb = await filters.boundingBox();
        expect(hb, "header bounding box").not.toBeNull();
        expect(fb, "filters bounding box").not.toBeNull();
        if (!hb || !fb) return;

        // Regra principal: topo da faixa de filtros >= base do header sticky.
        // Tolerância de 1px para arredondamentos de subpixel.
        expect(fb.y + 1).toBeGreaterThanOrEqual(hb.y + hb.height);

        // Após scroll, a invariante deve continuar valendo (ambos são sticky).
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(300);
        const hb2 = await header.boundingBox();
        const fb2 = await filters.boundingBox();
        if (hb2 && fb2) {
          expect(fb2.y + 1).toBeGreaterThanOrEqual(hb2.y + hb2.height);
        }
      });
    }
  }
});
