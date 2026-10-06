# Relatório final — Hardening de segurança 1001Jobs

Princípio: Zero Trust + Assume Breach + Defense in Depth + Least Privilege + Crypto Agility + Secure by Design.
Invadir uma camada não deve permitir dominar a próxima: app → identidade → pagamentos → chaves.

## 1. Security Architecture
```text
Navegador (PWA, CSP, sem segredos)
   │ JWT curto + MFA opcional
Funções do servidor (_shared/security.ts: CORS, rate limit, validação, anti-replay, timeout)
   │ crachás assinados entre serviços (_shared/guard.ts)
Banco (RLS por dono/papel, colunas sensíveis revogadas, get_profiles_private)
   │ security_events append-only, gatilhos anti-ransomware, honeytoken
1001Pay (isolada) → txPolicy → signer/MPC/multisig (alvo) → Solana
```

## 2. Threat Model
`docs/threat-model.md` — STRIDE + classificação CRÍTICO/ALTO/MÉDIO/BAIXO por ator.

## 3. Security Changes
Etapas 1–40 detalhadas em `SECURITY.md`. Regras permanentes em `AGENTS.md`.

## 4. Files Changed (principais)
- `index.html` (CSP), `src/lib/safeLog.ts`, `src/lib/privateProfile.ts`, `src/hooks/useAuth.tsx`
- `src/components/dashboard/IdentitySecurityCard.tsx`, `SecuritySection.tsx`
- `src/components/admin/SecurityEventsCard.tsx`, `AdminSecurityPanel.tsx`
- `src/pages/Dashboard.tsx`, `ClientProfile.tsx`, `AdminManagement.tsx`, `AdminInvestorAudit.tsx`, `EmergencyNotificationsCenter.tsx`, `SecondaryProfileSection.tsx`
- `supabase/functions/_shared/{security,guard,crypto,txPolicy}.ts` + 26 funções com CORS/rate limit
- `.github/workflows/ci.yml` (job security), `SECURITY.md`, `docs/*`, `AGENTS.md`

## 5. Database Changes (todas aditivas)
- Modo Navegação: `navigation_settings`, `task_navigation_events`, colunas em `service_tracking`, `record_navigation_event`, `confirm_task_arrival`.
- Políticas restritas: `provider_composite_scores`, `ai_model_versions`, `ai_regional_stats`, `provider_ranking_scores`, `investor_kpis`, `regional_traffic_stats`, `provider_availability`, listagem de arquivos em `avatars`/`portfolio`/`review-evidence`.
- `profiles`: leitura de colunas sensíveis revogada; `get_profiles_private`; coluna `public_ref`.
- `location_access_log`, `purge_old_location_history` (diário, 90 dias).
- `security_events`, `raise_security_event`, `log_client_security_event`, gatilhos de papel e exclusão em massa, `security_detect_signals` (de hora em hora), honeytoken `admin_export_credentials`.

## 6. Dependencies Added
Nenhuma dependência de runtime nova. Atualizadas: `@supabase/supabase-js`, `react-router-dom`; `overrides` para transitivas. CI usa `audit-ci`, `gitleaks-action`, `@cyclonedx/cyclonedx-npm` (só no pipeline).

## 7. Secrets (só local e tipo)
Ver `docs/secrets-inventory.md`. Privados apenas no cofre do servidor (pagamentos, e-mail, IA, bots, serviço interno). No navegador só chaves publicáveis (backend público, mapas restrito por domínio).

## 8. Tests
185 testes automáticos passando (inclui `security-hardening`, `security-regression`, `radar-task-isolation`, `task-navigation`).

## 9. Vulnerabilities
| Achado | Nível | Status |
|---|---|---|
| Dados pessoais de perfis visíveis a logados | Crítico | Corrigido |
| Tabelas com leitura aberta (ranking, IA, KPIs, trânsito) | Alto | Corrigido |
| Listagem pública de arquivos | Médio | Corrigido |
| Funções sem JWT (ai-match, dispatch, kyc-ocr) | Alto | Corrigido |
| Avisos moderados em dependências do PWA / react-router v7 | Médio | Aberto (exige upgrade major) |
| Funções de banco executáveis por logados (avisos do linter) | Baixo | Aceito — todas validam dono/papel internamente |

## 10. Rollback
- Código: restaurar versão anterior pelo histórico do projeto.
- Políticas: recriar a política antiga (`CREATE POLICY ... USING (true)`) — nomes antigos listados nas migrations de 2026-10-06.
- Colunas de perfis: `GRANT SELECT ON public.profiles TO authenticated`.
- Tarefas agendadas: `cron.unschedule('security-detect-signals')`, `cron.unschedule('purge-location-history-daily')`.
- Gatilhos: `DROP TRIGGER role_change_alert / mass_delete_*` (não apagam dados).

## 11. 1001Pay Readiness
Prontos: isolamento de chaves (nenhuma na 1001Jobs), `txPolicy` (aprovar/step-up/revisão/bloqueio), crachás entre serviços, MFA, risk-score, log append-only, crypto versionada.
Pendentes (infra da 1001Pay): signer isolado, HSM, MPC, multisig de tesouraria hot/warm/cold, attestation de dispositivo no app nativo.
