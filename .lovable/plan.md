# Plano — Versionamento, Rotação HMAC, Rollback e Auditoria no Módulo ETA

## 1. Migração de banco (uma migration)

**Colunas novas em `eta_alert_deliveries`:**
- `template_id uuid`, `template_version int` — versão do template usada no envio (email)
- `webhook_id uuid`, `webhook_version int` — versão ativa do webhook no momento do envio
- `payload_size int`
- `hmac_validated boolean`, `hmac_validation_error text`, `hmac_validated_at timestamptz`

**Colunas novas em `eta_alert_webhooks`:**
- `version int default 1`
- `secret_next text`, `secret_next_activates_at timestamptz`, `secret_expires_at timestamptz`

**Nova tabela `eta_alert_webhook_versions`** (snapshot por mudança, trigger igual ao de templates):
- `webhook_id`, `version`, `name`, `url`, `headers`, `alert_types`, `min_severity`, `max_retries`, `changed_by`, `changed_at`

**Nova tabela `eta_alert_rollback_log`:**
- `entity_type` ('template'|'webhook'), `entity_id`, `from_version`, `to_version`, `reverted_by`, `reverted_at`, `reason`

**Trigger** `eta_alert_webhook_snapshot()` — incrementa `version`, salva snapshot na tabela de versões.

**Function `rollback_eta_template(_id, _to_version, _reason)`** — bloqueia se houver entrega `pending` ainda usando essa versão; copia campos da versão alvo para o registro principal (trigger gera nova versão); insere em `eta_alert_rollback_log`. Idem `rollback_eta_webhook`.

**Function `rotate_eta_webhook_secret(_id, _new_secret, _grace_minutes)`** — move atual para `secret`, define `secret_next` ou agenda ativação. Variante `promote_eta_webhook_next_secret` para promover `secret_next` → `secret`.

GRANTs e RLS já existentes nas tabelas pai aplicam-se.

## 2. Edge function `eta-alerts-monitor`
- Ao buscar template/webhook, capturar `id` e `version` e gravar em `eta_alert_deliveries`.
- Gravar `payload_size = bodyStr.length`.
- HMAC: se webhook tem `secret_next` ativo, assinar com `secret` atual e enviar header extra `X-Webhook-Signature-Next` com a próxima — assim o destinatário pode validar com qualquer das duas durante rotação. Auto-promover `secret_next` → `secret` quando `secret_next_activates_at <= now()`.

## 3. Nova edge function `eta-webhook-test`
- Recebe `{ webhook_id }` (admin only via JWT + `has_role`).
- Monta payload sintético `{ test: true, alert_type:"persistent_degradation", ... }`.
- Assina com HMAC, faz POST e mede latência.
- Retorna `{ http_status, duration_ms, signature, signature_algo, body_sent, response_preview }`.
- Loga em `eta_alert_deliveries` com `target_label: '[TEST]'` e flag em metadata.

## 4. Nova edge function `eta-hmac-verify` (callback opcional)
- Endpoint público que o destinatário pode chamar de volta para registrar `hmac_validated` no delivery (`delivery_id` + boolean + erro). Usada também internamente pelo botão "Testar webhook" para gerar entrada de auditoria.

## 5. `/admin/eta/alertas` (AdminEtaAlerts.tsx)
- Novos filtros: `template_version` (select carregando versões distintas), `webhook_version` (idem), e agrupamento adicional "Versão template" / "Versão webhook".
- Exportações CSV/JSON incluem as novas colunas.
- Nova seção colapsável **"Auditoria HMAC"** abaixo da tabela: agrega por `target_label` mostrando total enviado, validações ok, falhas, último erro, último payload size e timestamp. Lê de `eta_alert_deliveries` com filtros do período atual.

## 6. `/admin/eta/config` (AdminEtaConfig.tsx)
- **Rollback:** botão "Reverter" em cada linha de histórico de versões — chama RPC, mostra confirmação, exibe motivo (textarea) e desabilita quando há alerts pendentes usando aquela versão (consulta prévia).
- **Histórico de rollback:** tabela mostrando quem reverteu, quando, de/para versão.
- **Rotação HMAC:** painel novo por webhook com:
  - Segredo atual (mascarado), data de expiração opcional.
  - Botão "Programar próximo segredo" (gera/recebe valor + data de ativação).
  - Botão "Promover agora".
- **Testar webhook:** botão "Testar" chama `eta-webhook-test` e exibe modal com status HTTP, tempo de resposta, assinatura enviada e resultado de validação registrado.

## 7. Detalhes técnicos
- Realtime já habilitado em `eta_alert_deliveries` — auditoria HMAC atualiza sozinha.
- Frontend usa `supabase.functions.invoke('eta-webhook-test', ...)` e RPC para rollback/rotate.
- Filtros aplicados na exportação reutilizam o mesmo state já existente; apenas estendido com os dois novos campos.

## 8. Testes
- Adicionar testes Deno em `eta-alerts-monitor/lib_test.ts` cobrindo: assinatura dupla durante rotação, captura de versão template/webhook, payload size.
- Teste para `rollback_eta_template` bloqueando quando há entrega pending.

---

Os arquivos a tocar:
- `supabase/migrations/<timestamp>_eta_versioning_rotation.sql` (novo)
- `supabase/functions/eta-alerts-monitor/index.ts` + `lib.ts` + `lib_test.ts`
- `supabase/functions/eta-webhook-test/index.ts` (novo)
- `supabase/functions/eta-hmac-verify/index.ts` (novo)
- `src/pages/AdminEtaAlerts.tsx`
- `src/pages/AdminEtaConfig.tsx`

Aprove para eu seguir com a implementação.