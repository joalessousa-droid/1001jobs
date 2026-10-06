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

## Etapas 6 a 12

- **6 Autorização:** todas as escritas diretas abertas ficam só com o servidor; clientes e profissionais leem apenas os próprios serviços, ofertas e rastreamentos; papéis em `user_roles` validados no banco. Ranking, versões da IA e estatísticas regionais restritos à administração. Pendente (exige aprovação, muda comportamento): esconder colunas sensíveis de `profiles` para outros usuários logados.
- **7 Criptografia:** TLS e criptografia em repouso (AES-256) da plataforma; senhas com hash do provedor de autenticação (bcrypt); segredos só no cofre do servidor. Sem MD5/SHA-1 para segurança (o `md5` do `public_ref` é só identificador, não proteção).
- **8 Hierarquia de chaves:** chaves separadas por domínio (pagamentos, e-mail, IA, mapas, serviços internos). KMS/HSM próprio fora do escopo da plataforma — arquitetura-alvo.
- **9 Identity Vault:** `profiles.public_ref` (ex.: `1001-8F29A…`) como identificador pseudônimo para logs e integrações; KYC segue em tabelas e bucket privados.
- **10 Localização:** histórico preciso apagado após 90 dias (tarefa diária); `location_access_log` para registrar acessos por finalidade; leitura da posição só durante serviço ativo.
- **11 API:** CORS restrito, limite de chamadas, validação de corpo, tamanho máximo, `rejectReplay` (nonce opcional) e `withTimeout`.
- **12 Tempo real:** eventos de banco em tempo real obedecem às mesmas regras de acesso das tabelas, então ninguém recebe mudanças de serviços de outra pessoa.

## Etapas 13 a 40

- **13 Risk Engine:** o score de risco existente (`risk-score`) segue como base; sinais novos entram em `security_events`. Baixo → segue; médio → verificação em duas etapas; alto → revisão manual. Nunca altera regras comerciais.
- **14 Fraud Engine:** `security_detect_signals()` roda de hora em hora e sinaliza documento repetido, GPS com velocidade impossível (>250 km/h) e rajada de avaliações. Só detecta e encaminha para revisão; não bloqueia nem exclui ninguém.
- **15 Dispositivo:** app hoje é web/PWA; Keystore/Keychain, attestation e root/jailbreak ficam para o app nativo. Impressão digital do dispositivo já existe (`device_fingerprints`).
- **16 Backup:** backups diários criptografados e restauração por versão são da plataforma, com credenciais separadas do app. O admin do app não tem acesso para apagar backups.
- **17 Anti-ransomware:** gatilhos alertam (crítico) quando 50+ perfis, serviços ou pagamentos são excluídos de uma vez; toda mudança de permissão gera alerta alto.
- **18 Honeytokens:** função-isca `admin_export_credentials` — qualquer chamada gera alerta crítico. Não usa dados reais.
- **19 Logs:** `security_events` só permite inclusão (não pode apagar nem editar, só mudar o status). Registra entrada/saída, permissões, exclusões em massa e fraude, sem senha, token ou dado sensível.
- **20 SIEM/SOC:** eventos centralizados em `security_events`, prontos para exportação; painel em Admin → Segurança.
- **21/22 DevSecOps e cadeia de suprimentos:** CI com auditoria de dependências (falha em vulnerabilidade crítica), varredura de segredos (gitleaks) e SBOM (CycloneDX). Pendências conhecidas: avisos moderados em dependências do PWA.
- **23 Crypto agility:** `_shared/crypto.ts` com algoritmo versionado no resultado (`sha256:`, `hs256:`, `a256gcm:`), chave por domínio via HKDF, só WebCrypto padrão.
- **24 Pós-quântico:** sem troca agora; o formato versionado permite adotar ML-KEM/ML-DSA híbrido no futuro. Prioridade: documentos KYC.
- **25 Confidential computing:** não disponível na plataforma; candidatos: identidade, risco e financeiro.
- **26–29 1001Pay / Solana / MPC:** a 1001Jobs não guarda chave privada nenhuma; fala com pagamentos só por funções autenticadas. `_shared/txPolicy.ts` decide aprovar / pedir verificação extra / revisão manual / bloquear por valor, risco, idade da conta, total do dia e horário. Signer isolado, MPC e multisig da tesouraria (hot/warm/cold) são arquitetura-alvo na infraestrutura da 1001Pay.
- **30 Biometria:** a verificação facial só compara e devolve sim/não; a biometria nunca vira chave.
- **31 Administração:** papéis em tabela separada, checados no servidor; toda mudança de papel gera alerta.
- **32 Break glass:** acesso de emergência = conta admin dedicada com MFA obrigatório; uso gera evento `privilege_change` e deve ser revisado depois.
- **33–35 Pentest, chaos e assume breach:** testes automáticos de isolamento (178), iscas e alertas em massa partem do princípio de que algo pode vazar; pentest externo recomendado antes de abrir a 1001Pay.
- **36–38 Compatibilidade, performance e privacidade:** tudo aditivo; detecção roda fora do caminho do usuário; dados sensíveis só para o dono e admin; localização com retenção de 90 dias.
- **39/40 Documentação e threat model:** este arquivo e `docs/threat-model.md`.
