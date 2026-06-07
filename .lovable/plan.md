# KYC — Métricas, OCR, validação de CPF, biometria em ações críticas e notificações

Implementação em 5 frentes independentes. Cada uma pode ser entregue isoladamente.

## 1. Painel Admin de Métricas KYC

**Rota**: `/admin/kyc/metricas` (protegida por `useIsAdmin`).

**RPC**: `get_kyc_metrics(_from, _to, _city)` retornando JSON com:
- `total`, `approved`, `rejected`, `in_review`, `pending`
- `approval_rate`, `rejection_rate`
- `avg_review_seconds` (de `submitted_at` até `decided_at`)
- `top_rejection_reasons` (top 10 agrupados)
- `daily` (série temporal: dia, submissões, aprovadas, reprovadas)
- `by_city` (breakdown quando `_city` for null)

**UI**: cards de KPI, gráfico de barras (recharts) por dia, tabela de motivos, filtro de período (7/30/90/custom) e select de cidade (populado de `profiles.city distinct`).

## 2. Componente `<CriticalActionGuard />` (re-uso ampliado)

Já existe `CriticalAuthGuard` para rotas. Criar wrapper **imperativo** `useCriticalAction()`:

```ts
const requireCritical = useCriticalAction();
await requireCritical({ context: "withdrawal" }); // throws if blocked
```

Plugar em 3 pontos:
- **Saque** (`EarningsSection` → botão "Solicitar saque"): exige senha + face match.
- **Alteração de senha** (`SecuritySection`): exige senha atual + face match se KYC aprovado.
- **Login suspeito**: hook em `useAuth` que, após login, consulta `risk-score`; se score ≥ limiar, força face match antes de liberar a sessão (flag `requires_face_check` em `profiles`).

Bloqueio: registra tentativa em `face_verification_attempts` com `decision='blocked'` e mostra toast com motivo.

## 3. OCR de Documento (CNH/RG)

Edge function `kyc-ocr` usando Gemini Vision (`google/gemini-2.5-flash`) via Lovable AI Gateway. Entrada: `submission_id`. Saída JSON:
```json
{ "name": "...", "cpf": "...", "rg": "...", "cnh": "...", "birth_date": "...", "doc_type": "rg|cnh" }
```

Compara com `kyc_submissions.cpf` e `profiles.full_name` (normalizando). Grava em novas colunas:
- `ocr_extracted` (jsonb)
- `ocr_name_match` (numeric 0..1)
- `ocr_cpf_match` (boolean)
- `ocr_checked_at` (timestamptz)

Disparada automaticamente no `INSERT` via trigger → `pg_net.http_post` para a função. Admin vê os matches no `/admin/kyc`.

## 4. Validação real de CPF

**Algoritmo local** (dígitos verificadores) em `src/lib/validators.ts` (`isValidCPF`) e replicado em SQL `public.is_valid_cpf(text)` para validar no `INSERT`.

**Consulta externa**: edge function `cpf-check` chamando API Serpro (requer `SERPRO_API_KEY` secret). Como Serpro exige contrato, implementar com **driver plugável**:
- Default: provider `algorithmic` (só validação local + flag `unverified_regularidade`).
- Se `SERPRO_API_KEY` presente: provider `serpro` (chama endpoint, retorna `situacao`).
- Resultado gravado em `kyc_submissions.cpf_regularidade` ('regular' | 'irregular' | 'unknown') e `cpf_checked_at`.

Admin não pode aprovar se `cpf_regularidade='irregular'` (constraint em `kyc-review` edge ou trigger).

Pedirei `SERPRO_API_KEY` apenas se o usuário confirmar que tem contrato Serpro; caso contrário, fica em modo algorítmico.

## 5. Notificações de status do KYC

**Trigger** `notify_kyc_status_change` no `kyc_submissions`:
- Em qualquer mudança de `status`, insere em `public.notifications` (in-app — já existe a tabela) com título/mensagem e link `/perfil/kyc`.
- Em `approved` ou `rejected`, também chama edge function `send-transactional-email` (Lovable Emails) com template apropriado.

**Templates** novos em `supabase/functions/_shared/transactional-email-templates/`:
- `kyc-in-review.tsx` — "Documentos recebidos"
- `kyc-approved.tsx` — "Identidade aprovada"
- `kyc-rejected.tsx` — "Reenvio necessário" com motivo + CTA para `/perfil/kyc`

Prerequisito: domínio de e-mail configurado + `setup_email_infra` + `scaffold_transactional_email`. Se ainda não existirem, vou disparar o setup antes do envio.

---

## Ordem de execução proposta

1. Migration única (RPC métricas + colunas OCR/CPF + trigger notificação + função `is_valid_cpf`).
2. Edge functions `kyc-ocr`, `cpf-check`.
3. Templates de e-mail + scaffold se necessário.
4. Página `/admin/kyc/metricas`.
5. Hook `useCriticalAction` + integração nos 3 pontos.
6. Atualização do `PerfilKyc.tsx` (validar CPF local antes do upload, exibir status de OCR/CPF na última submissão).
7. Atualização do `AdminKyc.tsx` (mostrar OCR matches, bloquear aprovação se CPF irregular).

## Pontos que precisam de confirmação rápida

- **Serpro**: você tem contrato/API key, ou seguimos só com algoritmo local + flag `unknown` (recomendado para MVP)?
- **E-mails**: posso configurar Lovable Emails (precisa de domínio) ou prefere usar Resend já existente?
- **Login suspeito**: limiar de risk-score para forçar face match (sugestão: ≥ 70)?

Se você responder "vai", assumo: Serpro = algorítmico, e-mails = Lovable Emails (com setup), limiar = 70.
