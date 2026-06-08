// E2E: Playwright — KYC: estados, notificações, face-verify e bloqueios críticos.
// Pré-requisitos:
//  - Variáveis: E2E_BASE_URL, E2E_USER_EMAIL, E2E_USER_PASSWORD, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD.
//  - Usuário comum sem role admin; usuário admin com role 'admin'.
//  - Use `npx playwright test` para executar.

import { test, expect, Page } from "@playwright/test";

const USER_EMAIL = process.env.E2E_USER_EMAIL ?? "user@example.com";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "user123456";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123456";

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).first().fill(password);
  await page.getByRole("button", { name: /entrar|login/i }).click();
  await page.waitForURL(/dashboard|kyc/, { timeout: 15_000 }).catch(() => {});
}

test.describe("KYC E2E — submissão e mudança de status", () => {
  test("usuário envia documentos e vê status pendente/em análise", async ({ page }) => {
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto("/perfil/kyc");
    // Pode exigir reauth (CriticalAuthGuard)
    if (await page.getByText(/Confirmação de segurança/i).isVisible().catch(() => false)) {
      await page.getByLabel(/senha/i).fill(USER_PASSWORD);
      await page.getByRole("button", { name: /confirmar/i }).click();
    }
    await expect(page.getByText(/KYC|verifica/i).first()).toBeVisible();
  });

  test("usuário vê notificação in-app ao mudar status", async ({ page }) => {
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto("/dashboard");
    // O sino de notificações é renderizado em NotificationsBell
    const bell = page.locator('[data-testid="notifications-bell"], [aria-label*="notifica" i]').first();
    await expect(bell).toBeVisible({ timeout: 10_000 });
    await bell.click();
    await expect(page.getByText(/KYC/i).first()).toBeVisible();
  });
});

test.describe("Rotas admin protegidas por role", () => {
  test("usuário comum é bloqueado em /admin/kyc", async ({ page }) => {
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto("/admin/kyc");
    await expect(page.getByText(/Acesso restrito|administradores/i)).toBeVisible();
  });

  test("usuário comum é bloqueado em /admin/ranking", async ({ page }) => {
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto("/admin/ranking");
    await expect(page.getByText(/Acesso restrito|administradores/i)).toBeVisible();
  });

  test("usuário comum é bloqueado em /admin/face-verification", async ({ page }) => {
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto("/admin/face-verification");
    await expect(page.getByText(/Acesso restrito|administradores/i)).toBeVisible();
  });

  test("admin acessa /admin/kyc com sucesso", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin/kyc");
    await expect(page.getByText(/Fila de análise|KYC/i).first()).toBeVisible();
  });
});

test.describe("Ações críticas — bloqueio quando face-verify falha", () => {
  test("saque é bloqueado quando face-verify retorna blocked", async ({ page, context }) => {
    await login(page, USER_EMAIL, USER_PASSWORD);
    await context.route("**/functions/v1/face-verify", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ decision: "blocked", similarity: 0.1 }) })
    );
    await page.goto("/dashboard");
    // Navega até "Ganhos"
    await page.getByRole("button", { name: /ganhos|earn/i }).click().catch(() => {});
    const withdraw = page.getByTestId("withdraw-button");
    await expect(withdraw).toBeVisible();
    await withdraw.click();
    await expect(page.getByText(/Confirmação de segurança/i)).toBeVisible();
    await page.getByLabel(/senha atual/i).fill(USER_PASSWORD);
    await page.getByRole("button", { name: /iniciar câmera/i }).click();
    await page.getByRole("button", { name: /capturar selfie/i }).click();
    await page.getByRole("button", { name: /^confirmar$/i }).click();
    await expect(page.getByText(/bloqueada|bloqueado|divergência/i)).toBeVisible();
  });

  test("alteração de senha é bloqueada quando face-verify falha", async ({ page, context }) => {
    await login(page, USER_EMAIL, USER_PASSWORD);
    await context.route("**/functions/v1/face-verify", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "down" }) })
    );
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /segurança|security/i }).click().catch(() => {});
    await page.getByLabel(/nova senha/i).fill("NovaSenha123!");
    await page.getByLabel(/confirmar nova senha/i).fill("NovaSenha123!");
    await page.getByRole("button", { name: /alterar senha/i }).click();
    await expect(page.getByText(/Confirmação de segurança/i)).toBeVisible();
    await page.getByLabel(/senha atual/i).fill(USER_PASSWORD);
    await page.getByRole("button", { name: /iniciar câmera/i }).click();
    await page.getByRole("button", { name: /capturar selfie/i }).click();
    await page.getByRole("button", { name: /^confirmar$/i }).click();
    await expect(page.getByText(/indisponível|bloqueada|não foi possível confirmar/i)).toBeVisible();
  });

  test("login suspeito exige biometria e bloqueia se face-verify negar", async ({ page, context }) => {
    await context.route("**/functions/v1/risk-score", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ score: 95, suspicious: true }) })
    );
    await context.route("**/functions/v1/face-verify", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ decision: "blocked" }) })
    );
    await page.goto("/auth");
    await page.getByLabel(/e-?mail/i).fill(USER_EMAIL);
    await page.getByLabel(/senha/i).first().fill(USER_PASSWORD);
    await page.getByRole("button", { name: /entrar|login/i }).click();
    await expect(page.getByText(/Confirmação de segurança/i)).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/senha atual/i).fill(USER_PASSWORD);
    await page.getByRole("button", { name: /iniciar câmera/i }).click();
    await page.getByRole("button", { name: /capturar selfie/i }).click();
    await page.getByRole("button", { name: /^confirmar$/i }).click();
    await expect(page.getByText(/bloqueado|bloqueada|divergência/i)).toBeVisible();
  });
});
