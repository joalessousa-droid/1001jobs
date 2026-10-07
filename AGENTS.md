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

## Protocolo Mestre de Engenharia (v1.0) — texto integral em `docs/prompt-mestre-protocolo.md`
- Nunca remover, desabilitar ou alterar funcionalidade existente sem necessidade explícita; preferir menor alteração necessária + máxima preservação.
- Mudança mínima: não reescrever módulos, não recriar componentes, não trocar bibliotecas/tecnologias sem justificativa técnica.
- Toda solicitação segue: interpretar → inspecionar → mapa de impacto → análise de regressão → segurança → implementar → testar → documentar.
- Alterações de impacto alto/crítico só após compreender dependências; analisar regressão em login, busca, matching, pagamento, navegação, avaliações, notificações, antifraude, KYC e administração.
- Zero Trust: dados críticos (status, preço, localização, permissão, confirmação de pagamento) sempre validados no servidor.
- Pagamento só é confirmado pela fonte oficial (webhook/API do sistema de pagamentos), nunca por resposta visual do frontend.
- Estados têm transições válidas; nunca permitir transições impossíveis; operações financeiras e de estado idempotentes (duplo clique, webhook duplicado, concorrência).
- Toda implementação avaliada em: teste normal, erro, concorrência, conexão, duplicidade, segurança, recuperação e regressão.
- Critério de aceitação: funcionalidade + interface + backend + banco + permissões + estados + erros tratados + segurança + regressões verificadas + testes.
- Proibido inventar APIs, endpoints, bibliotecas, tabelas, campos ou credenciais; dependência indisponível deve ser sinalizada explicitamente.
- Hierarquia de prioridades: segurança > integridade de dados > integridade financeira > funcionalidade existente > regra de negócio > confiabilidade > performance > UX > estética > simplicidade.
- Mundos de comando: "ALTERAÇÃO CIRÚRGICA" = só o necessário, nada paralelo; "AUDITAR" = análise sem modificar (classificar CRÍTICO/ALTO/MÉDIO/BAIXO/INFORMATIVO), implementar só com autorização; "HARDENING" = procurar vulnerabilidades sem alterar regras de negócio.
- Erro crítico nunca termina com "Erro."; informar o que ocorreu, estado pendente e próximo passo; logs internos sem dados sensíveis.
- Fail safe: em dúvida, não liberar dinheiro, não conceder permissão, não apagar dados, não alterar estado irreversível.
- Documentar cada alteração: o que mudou, motivo, componentes, dependências, riscos, testes e resultado.

## Localized legal notices
- Keep full privacy notices as structurally equivalent locale documents selected through the existing i18next language, with Portuguese fallback, so translations preserve every section and do not affect business logic.
