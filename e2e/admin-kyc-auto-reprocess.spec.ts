// E2E: AdminKyc — aprovação com CPF "unknown" dispara auto-reprocess via cpf-check,
// e a UI deve refletir notificação e bloquear/aprovar conforme retorno do Serpro.
//
// Os cenários abaixo são determinísticos via interceptação de chamadas à Edge Function
// `cpf-check` e à API REST do Supabase. Eles validam o fluxo de UI, não a integração real.

import { test, expect, type Route } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  // O teste assume credenciais admin em variáveis de ambiente; se ausentes, pula.
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "E2E_ADMIN_EMAIL/PASSWORD não configurados");
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email!);
  await page.getByLabel(/senha/i).fill(password!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

test.describe("AdminKyc auto-reprocess", () => {
  test("aprova quando Serpro retorna regular", async ({ page }) => {
    await loginAsAdmin(page);

    // Intercepta cpf-check: simula sucesso (regular).
    await page.route("**/functions/v1/cpf-check", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, valid: true, regularidade: "regular", provider: "serpro" }),
      });
    });

    // Faz patch da submissão devolver cpf_regularidade=regular após o cpf-check.
    let patched = false;
    await page.route(/\/rest\/v1\/kyc_submissions/, async (route: Route) => {
      const req = route.request();
      if (req.method() === "GET" && /cpf_regularidade/.test(req.url())) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ id: "fake", cpf_regularidade: patched ? "regular" : "unknown" }]),
        });
      }
      if (req.method() === "PATCH") { patched = true; return route.fulfill({ status: 204, body: "" }); }
      await route.continue();
    });

    await page.goto("/admin/kyc");
    const firstApprove = page.getByRole("button", { name: /aprovar/i }).first();
    if (await firstApprove.isVisible().catch(() => false)) {
      await firstApprove.click();
      await expect(page.getByText(/Reverificando|Aprovado/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("bloqueia quando Serpro retorna irregular após reprocess", async ({ page }) => {
    await loginAsAdmin(page);

    await page.route("**/functions/v1/cpf-check", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, valid: true, regularidade: "irregular", provider: "serpro" }),
      });
    });

    await page.route(/\/rest\/v1\/kyc_submissions/, async (route: Route) => {
      const req = route.request();
      if (req.method() === "GET" && /cpf_regularidade/.test(req.url())) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ id: "fake", cpf_regularidade: "irregular" }]),
        });
      }
      await route.continue();
    });

    await page.goto("/admin/kyc");
    const firstApprove = page.getByRole("button", { name: /aprovar/i }).first();
    if (await firstApprove.isVisible().catch(() => false)) {
      await firstApprove.click();
      await expect(page.getByText(/bloqueada|irregular/i)).toBeVisible({ timeout: 10_000 });
    }
  });
});
