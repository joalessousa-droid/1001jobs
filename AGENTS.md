# Regras do projeto 1001Jobs

## Segurança (Prompt Mestre — regras permanentes)
- Hardening sempre aditivo, compatível, reversível e testável — nunca alterar fluxos, preços, matching, ETA, Radar ou KYC existentes sem aprovação.
- Vulnerabilidade crítica encontrada: não ignorar nem esconder; corrigir de forma compatível, registrar risco, arquivo, solução e impacto em `docs/security-final-report.md` e criar teste de regressão em `src/test/`.
- Proibido sem aprovação explícita: migração destrutiva, DROP de tabela, apagar dados, alterar IDs, modificar registros financeiros históricos, remover endpoints, trocar banco ou arquitetura por preferência.
- Autorização sempre no banco/servidor (RLS + `has_role`/`ai_is_staff`); papéis só em `user_roles` — porque o navegador é manipulável.
- Dados sensíveis de `profiles` (CPF, telefone, endereço, nascimento, mãe, representante) só via `get_profiles_private` (`src/lib/privateProfile.ts`) — colunas revogadas para leitura direta.
- Eventos de segurança vão para `security_events` (append-only) via `raise_security_event`; nunca registrar senha, token, chave ou biometria.
- 1001Pay isolada: a 1001Jobs nunca guarda chave privada; operações financeiras passam por `_shared/txPolicy.ts`; Solana permanece a blockchain da 1001Pay.
- Criptografia só por `_shared/crypto.ts` (algoritmo versionado, WebCrypto padrão) — para permitir troca futura (pós-quântico) sem reescrever chamadores.
- Princípio: Zero Trust + Assume Breach + Defense in Depth + Least Privilege + Crypto Agility + Secure by Design.
