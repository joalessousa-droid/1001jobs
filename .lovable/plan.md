# Hardening de segurança 1001Jobs (aditivo, sem alterar funcionalidades)

O documento enviado tem 40 etapas, incluindo itens que dependem de infraestrutura que a plataforma não possui (HSM próprio, mTLS entre serviços, SIEM/SOC, confidential computing, MPC/Solana). O plano abaixo aplica tudo que é viável neste projeto, em camadas aditivas e reversíveis, e lista separadamente o que fica fora do escopo técnico atual.

## Bloqueio atual

O banco de dados hospedado está pausado. Nenhuma alteração de banco (regras de acesso, tabelas de auditoria, funções) pode ser aplicada até você reativá-lo em Connectors → Lovable Cloud → Retomar. As etapas de código (fase 1) podem ser feitas antes disso.

## Fase 1 — Auditoria e código (não depende do banco)

1. Relatório de arquitetura e superfícies de ataque: rotas, telas administrativas, funções de borda, integrações externas, pontos de entrada públicos.
2. Inventário de segredos: varredura de chaves em código, arquivos e logs. Relatório no formato `SEGREDO — LOCAL — TIPO — RISCO`, sem expor valores. Nenhuma chave publicável é tratada como incidente.
3. Cabeçalhos de segurança e CSP no HTML da aplicação.
4. Validação de entrada com schema em todas as funções de borda que hoje aceitam corpo livre, com limite de tamanho e tempo.
5. CORS restrito à origem do app e aos domínios publicados, no lugar de `*`.
6. Rate limiting por usuário/IP nas funções sensíveis (login, KYC, disputas, bots, pagamentos), com tabela de contadores.
7. Remoção de dados sensíveis de logs e mensagens de erro.
8. Varredura de dependências e atualização das que tiverem correção disponível.
9. `SECURITY.md` e modelo de ameaças (STRIDE) documentados no repositório.

## Fase 2 — Banco e autorização (depois de reativar)

10. Correção das duas pendências de segurança já abertas:
    - tabela de perfis expõe CPF/CNPJ, telefone, endereço, data de nascimento e nome da mãe a qualquer usuário logado → acesso restrito ao dono e à administração, com uma visão pública contendo apenas nome, foto, cidade, avaliação e categorias;
    - revisão das visões com `SECURITY DEFINER`.
11. Conferência de RLS tabela por tabela: cliente só vê seus dados, prestador só vê tarefas autorizadas, administração validada no servidor (nunca no navegador).
12. Registro de auditoria de segurança: tabela append-only com autor, ação, alvo, IP e dispositivo, gravada em ações administrativas, mudanças de cadastro, acesso a KYC e acesso a localização.
13. Privacidade de localização: retenção limitada das posições precisas (expurgo automático após o serviço), acesso registrado, precisão reduzida fora do período do atendimento.
14. Canais em tempo real restritos por autorização — usuário não recebe eventos de outro.
15. Migração pendente do Modo Navegação (tabelas e funções de chegada), já preparada.

## Fase 3 — Camadas de risco e identidade

16. Motor de risco unificado sobre o score já existente: sinais de dispositivo, IP, localização, velocidade impossível, troca de credenciais. Baixo → segue; médio → verificação extra; alto → revisão manual. Nunca altera regras comerciais nem exclui conta automaticamente.
17. Motor antifraude: contas duplicadas, avaliações manipuladas, GPS falsificado, comportamento automatizado — sempre detecção e revisão, nunca exclusão automática.
18. Identidade: rotação de sessão, revogação, detecção de reuso de token, e segundo fator por passkey como opção adicional (o login atual continua funcionando).
19. Honeytokens e alertas em acessos anômalos a dados sensíveis.
20. Painel administrativo de segurança com eventos, riscos abertos e ações.

## Fora do escopo técnico atual

mTLS entre serviços, HSM dedicado, SIEM/SOC externo, confidential computing, criptografia pós-quântica e a camada Solana/MPC da 1001Pay dependem de infraestrutura fora desta aplicação. Serão documentados como arquitetura-alvo em `SECURITY.md`, sem implementação.

## Garantias

Nada é removido ou desativado. Cada fase termina com verificação de tipos e a suíte de testes completa (172 testes hoje) mais testes novos para as regras de acesso.
