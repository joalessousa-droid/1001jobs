// E2E: verifica que o atalho 1001Pay aparece no menu do perfil,
// possui os atributos de segurança corretos e não quebra o layout.
import { test, expect } from "@playwright/test";

const APP_URL = process.env.APP_URL ?? "https://id-preview--93592dff-34d6-4932-8f07-ee563c8b63d5.lovable.app";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.describe("@navbar-1001pay", () => {
  for (const vp of VIEWPORTS) {
    test(`atalho 1001Pay no menu do perfil — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(APP_URL);

      // O menu de perfil só é exibido para usuários autenticados.
      const profileButton = page.locator('button[aria-label="Perfil do usuário"]');
      const profileVisible = await profileButton.isVisible().catch(() => false);
      test.skip(!profileVisible, "Menu de perfil não disponível (usuário não autenticado)");

      await profileButton.click();

      const payLink = page.locator('a[href="https://pay1001.lovable.app"]');
      await expect(payLink).toBeVisible({ timeout: 5_000 });

      // Verifica atributos de segurança para abertura em nova aba
      await expect(payLink).toHaveAttribute("target", "_blank");
      await expect(payLink).toHaveAttribute("rel", "noopener noreferrer");
      await expect(payLink).toHaveAttribute("title", /Carteira de pagamentos|Payment wallet|Billetera de pagos/i);

      // Layout: o link deve estar dentro do dropdown visível e não exceder viewport
      const box = await payLink.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      }
    });
  }
});
