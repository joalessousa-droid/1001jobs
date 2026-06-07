
# Plano — Finalização 4/5 + Módulos 6, 7 e 8

## Onda A — Finalização Módulos 4 e 5 (revisão ampla)

**Banco / cron**
- Cron job `expire_stale_offers` a cada 10 s (via `pg_cron` + `pg_net`) para nunca depender do navegador para expirar ofertas.
- View `v_provider_offer_metrics` (taxa aceite, recusa, expiração, tempo médio de resposta por profissional, 30 dias).
- RPC `get_provider_offer_history(_from, _to, _status)` para o painel do profissional.

**UI profissional**
- Página `/profissional/ofertas`: lista ofertas pendentes + histórico + KPIs pessoais (aceite %, tempo médio, ranking interno simplificado).
- Componente `OfferCard`: barra de progresso animada de 30 s, som curto ao receber (toggle persistido), badge no header com contador de ofertas ativas.
- Hook realtime `useProviderOffers` (canal `service_offers` filtrado por `provider_id`).

**UI admin**
- Em `/admin/dispatch/funil`: aba “Logs de matching” lendo `service_matching_logs` com filtros (request, raio, n_candidatos, decision) e botão “Replay” que reexecuta `dispatch-service-offers` em modo dry-run.

## Onda B — Módulo 6: Fila Inteligente de Serviços

- Tabela `provider_ranking_scores` (provider_id, score_total, score_rating, score_anti_cancel, score_proximity, score_specialization, score_recurrence, sample_size, computed_at).
- Função `recompute_provider_ranking(_provider_id uuid default null)` (SECURITY DEFINER) que normaliza cada componente 0–1, aplica pesos da `dispatch_match_weights` ativa e grava em `provider_ranking_scores`.
- Edge function `provider-ranking-recompute` agendada (cron horário) — recalcula todos os profissionais ativos.
- `dispatch-service-offers` consome `provider_ranking_scores.score_total` como fator multiplicativo (com fallback no cálculo legado se score ausente).
- Página admin `/admin/ranking`: tabela com top 100, busca, breakdown dos componentes, último cálculo, botão “Recalcular agora”.

## Onda C — Módulo 7: KYC

- Bucket privado `kyc-docs` + RLS (`auth.uid()` insert/select próprios; admins/moderadores leem tudo).
- Tabela `kyc_submissions` (profile_id, status `pending|in_review|approved|rejected`, cpf, rg_number, cnh_number, selfie_path, doc_front_path, doc_back_path, cpf_valid bool, doc_valid bool, face_match_score numeric, reviewer_id, reviewer_notes, submitted_at, decided_at).
- Migration estende `eta_alert_rollback_log`-style audit em `kyc_status_history`.
- Edge function `kyc-submit` (validações: tamanho/MIME, CPF dígito verificador, normalização) → cria registro + grava `audit_logs`.
- Edge function `kyc-review` (admin only) → aprova/rejeita + atualiza `profiles.verification_status`.
- Página `/perfil/kyc` (usuário): wizard 3 passos (Documento → CPF/RG/CNH → Selfie) com upload, preview e status.
- Página `/admin/kyc` (admin): fila com filtros, viewer lado-a-lado documento+selfie, ações aprovar/rejeitar com motivo.

## Onda D — Módulo 8: Reconhecimento Facial

- Reutiliza `kyc-docs/selfie` como baseline.
- Tabela `face_verification_attempts` (profile_id, attempt_at, similarity numeric, decision `approved|review|blocked`, ip_address, user_agent, fingerprint_hash, context `login|payment|withdrawal`).
- Edge function `face-verify` recebe `selfie_base64` + `context`; chama Lovable AI (Gemini Vision multimodal) com a foto baseline + nova selfie e pede um score de similaridade estruturado (JSON). Limiares: ≥0.80 aprova, 0.60–0.79 marca review, <0.60 bloqueia (+ insere `audit_logs` e cria `notifications` para admin).
- Hook `requireFaceVerification(context)` chamado em ações críticas (saque, troca de e-mail, login após risco elevado).
- Componente `<FaceVerificationDialog />`: captura via `getUserMedia`, preview, envia para a função, mostra resultado + retry; bloqueia formulário pai se decisão = `blocked`.
- Admin `/admin/face-verification`: log de tentativas com filtros e gráfico de aprovações/bloqueios.

## Pontos técnicos transversais

- Todas as migrations seguem a regra de `GRANT` antes de `ENABLE RLS` + `CREATE POLICY`.
- i18n: novas strings (PT/EN/ES) sob namespaces `kyc.*`, `face.*`, `ranking.*`, `offers.*`.
- Tema escuro, tokens semânticos, sem cores hard-coded.
- Termo “Tarefa” preservado.
- Sem `LOVABLE_API_KEY` extra: a função `face-verify` usa o gateway nativo (`google/gemini-2.5-flash-image` / `gemini-2.5-flash`).

## Entrega proposta

Vou implementar nesta ordem A → B → C → D, agrupando migrations por onda para reduzir prompts de aprovação. Cada onda é independente e funciona sozinha caso você queira parar antes do fim.
