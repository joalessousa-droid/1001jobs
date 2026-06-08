# E2E Playwright

Cobertura: KYC (estados/notificações), proteção de rotas admin, bloqueio crítico
de saque/troca de senha/login suspeito quando o face-verify falha.

## Setup local

```bash
bun add -D @playwright/test
bunx playwright install --with-deps chromium
```

Variáveis de ambiente esperadas:

- `E2E_BASE_URL` (default: `http://localhost:8080`)
- `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` — usuário comum (sem role admin)
- `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` — usuário com `role = 'admin'`

## Execução

```bash
bun run dev &        # ou aponte E2E_BASE_URL para preview/staging
bunx playwright test
```

Os testes injetam mocks via `context.route` no `face-verify` e `risk-score`,
e usam `--use-fake-device-for-media-stream` para que o `WebcamCapture`
forneça um `selfie_base64` válido sem hardware real.
