# Segurança — 1001Jobs

Este documento descreve os controles de segurança implantados na plataforma, o que está
planejado e como relatar vulnerabilidades. Todo o hardening é **aditivo**: nenhuma
funcionalidade existente foi removida, substituída ou alterada em seu comportamento.

## Como relatar uma vulnerabilidade

Envie a descrição técnica, passos de reprodução e impacto para o canal de suporte
administrativo da plataforma. Não divulgue publicamente antes da correção.
Prazo alvo de resposta: 72 horas.

## Arquitetura resumida

| Camada | Tecnologia | Superfície |
|---|---|---|
| Frontend | React + Vite (SPA), PWA | público |
| Backend gerenciado | Postgres com RLS, Auth, Storage, Realtime | autenticado |
| Funções de borda | Deno (35 funções) | público/autenticado/cron |
| Integrações | Stripe, Resend, Google Maps/Routes, Gemini (AI Gateway) | servidor |

## Controles implantados

### Origem e transporte
- CORS restrito: apenas o domínio publicado, previews oficiais e desenvolvimento local.
  Requisições de navegador vindas de outras origens recebem `403 origin_not_allowed`.
- `Vary: Origin` em todas as respostas das funções.
- Content Security Policy no documento HTML, com `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'` e `upgrade-insecure-requests`.
- `referrer` em `strict-origin-when-cross-origin`.
- TLS é terminado pela plataforma de hospedagem (TLS 1.3).

### Abuso e disponibilidade
- Limite de chamadas por usuário autenticado ou IP nas funções sensíveis
  (KYC, verificação facial, CPF, pagamentos, disputas, IA, radar/dispatch, bots, SOS).
  Respostas `429` com `Retry-After`; preflight nunca é limitado.
- Limite de tamanho de corpo (256 KB) e validação de esquema sem dependências externas
  (`supabase/functions/_shared/security.ts`).

### Autenticação e autorização
- Todas as funções internas exigem JWT válido (`_shared/guard.ts`); papel de
  administrador/moderador é verificado no servidor, nunca no navegador.
- Papéis ficam em tabela separada (`user_roles`) e são lidos pela função
  `has_role`/`ai_is_staff` com `SECURITY DEFINER`, evitando escalada de privilégio.
- Modo simulação/teste do Radar exige papel de administrador tanto na interface
  quanto na consulta de profissionais no banco.
- Chamadas de cron/backend usam segredo compartilhado (`CRON_SECRET` /
  `INTERNAL_FUNCTION_SECRET`), nunca chave de serviço no cliente.

### Dados pessoais e privacidade (LGPD)
- Mascaramento de PII antes de qualquer log, no servidor (`redact`, `safeLog`) e no
  navegador (`src/lib/safeLog.ts`): CPF/CNPJ, telefone, e-mail, endereço, data de
  nascimento, nome da mãe, coordenadas, tokens e chaves.
- Mensagens de erro ao usuário não expõem detalhes de banco, SQL ou tokens.
- Tarefas do Radar são isoladas das telas comuns e das notificações.

### Segredos
- Nenhuma chave privada no repositório. O arquivo `.env` contém apenas chaves
  publicáveis de navegador (Supabase publishable key, Google Maps browser key).
- Chaves privadas (Stripe, Resend, AI Gateway, service role) ficam no cofre de segredos
  da plataforma e só são lidas dentro das funções de borda via `Deno.env.get`.
- Recomendação operacional: restringir a chave de navegador do Google Maps por
  referenciador HTTP no console do Google.

### Cadeia de suprimentos
- Varredura de dependências a cada ciclo; versões corrigidas forçadas por `overrides`
  em `package.json` (lodash, dompurify, fflate, browserslist, picomatch, rollup,
  brace-expansion, glob, minimatch, ajv).
- Bibliotecas principais atualizadas: `@supabase/supabase-js`, `react-router-dom`.

## Roadmap (arquitetura-alvo)

Itens que dependem de infraestrutura fora desta aplicação e estão documentados como
alvo, sem implementação atual:

- mTLS entre serviços e malha de serviço com identidade própria;
- KMS/HSM dedicado com envelope encryption (ROOT → KEK → DEK) e rotação automática;
- cofre de identidade isolado para CPF, documentos e biometria, com identificadores
  pseudônimos entre serviços;
- SIEM/SOC externo com correlação e resposta a incidentes;
- confidential computing e criptografia pós-quântica (crypto agility);
- 1001Pay sobre Solana: MPC/multisig, política de transações e biometria de pagamento,
  tratada como infraestrutura financeira separada da 1001Jobs.

## Plano em andamento

1. **Fase 1 (concluída)** — origem, limites, validação, CSP, mascaramento de logs,
   dependências, documentação.
2. **Fase 2 (depende do banco ativo)** — restrição de colunas sensíveis em `profiles`,
   revisão de RLS tabela a tabela, trilha de auditoria append-only, retenção e
   pseudonimização de localização, autorização por canal em tempo real.
3. **Fase 3** — motor de risco unificado, motor antifraude, passkeys como segundo fator
   opcional, honeytokens e painel administrativo de segurança.

## Princípios

`ADITIVO + COMPATÍVEL + REVERSÍVEL + TESTÁVEL` — nenhuma alteração de segurança pode
mudar regra comercial, preço, matching, ETA, Radar, mapas ou avaliações.

## Etapa 4 — Zero Trust (implementado)
- `_shared/guard.ts`: tokens de serviço assinados (HMAC-SHA256, cabeçalho `x-service-token`) com emissor, destinatário por função, validade máxima de 5 min e lista de emissores permitidos (`mintServiceToken` / `verifyServiceToken`).
- Comparação de segredos em tempo constante; segredo legado `x-internal-secret`/`x-cron-secret` continua aceito (migração gradual).
- Toda função sensível valida JWT no código, papel via `user_roles` e origem permitida.
- mTLS entre serviços: fora do alcance da plataforma (arquitetura-alvo).

## Etapa 5 — Identidade (implementado, migração gradual)
- Verificação em duas etapas (TOTP) opcional em Painel → Segurança; encerrar sessões em outros aparelhos.
- Tokens de acesso de curta duração, rotação de refresh token e detecção de reuso: nativos do provedor de autenticação.
- Login Google via OIDC já disponível; login por e-mail/senha continua funcionando.
- Passkeys/WebAuthn/FIDO2 e device binding: próxima fase, quando suportados como fator nativo pelo provedor.
