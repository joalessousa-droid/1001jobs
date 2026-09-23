# Modelo de ameaças — 1001Jobs (STRIDE)

Escopo: aplicação web/PWA, banco gerenciado com RLS, 35 funções de borda e integrações
(Stripe, Resend, Google Maps/Routes, Gemini).

## Ativos críticos

| Ativo | Sensibilidade | Onde vive |
|---|---|---|
| Identidade e KYC (CPF/CNPJ, documentos, selfie, nome da mãe) | crítica | tabela de perfis, storage |
| Localização em tempo real de profissionais e endereços de clientes | alta | rastreamento, radar |
| Conversas e disputas | alta | chat, disputas |
| Dados financeiros e assinaturas | crítica | Stripe, carteira 1001Pay |
| Papéis administrativos | crítica | tabela de papéis |
| Segredos de integração | crítica | cofre da plataforma |

## Fronteiras de confiança

```text
Navegador (não confiável)
   │  HTTPS + CORS restrito + CSP
   ▼
Funções de borda (semi-confiável)  ──segredo interno──  Cron/backend
   │  JWT + papel verificado no servidor
   ▼
Banco com RLS (confiável)  ──chave de serviço──  Integrações externas
```

## Ameaças e mitigações

### S — Spoofing (falsificação de identidade)
| Ameaça | Mitigação | Estado |
|---|---|---|
| Uso de token roubado | sessões curtas com rotação, revogação | parcial (fase 3: detecção de reuso, passkeys) |
| Chamada de função sem login | JWT obrigatório em todas as funções | implantado |
| Falsificação de cron | segredo compartilhado dedicado | implantado |
| GPS falsificado | validação de precisão, permanência e velocidade na chegada | implantado (fase 3: correlação antifraude) |

### T — Tampering (adulteração)
| Ameaça | Mitigação | Estado |
|---|---|---|
| Alteração de preço/oferta pelo cliente | preço gravado por função do banco, não pelo navegador | implantado |
| Corpo de requisição malicioso | validação de esquema + limite de 256 KB | implantado |
| Escrita direta em tabelas | RLS por dono + papéis | implantado (revisão tabela a tabela na fase 2) |

### R — Repudiation (repúdio)
| Ameaça | Mitigação | Estado |
|---|---|---|
| Ação administrativa sem rastro | trilha append-only com autor, alvo, IP e dispositivo | fase 2 |
| Eventos de navegação/chegada contestados | eventos registrados com origem e coordenadas | implantado |

### I — Information disclosure (vazamento)
| Ameaça | Mitigação | Estado |
|---|---|---|
| Qualquer usuário logado lê CPF, telefone e endereço de terceiros | restringir colunas sensíveis ao dono e à administração; visão pública reduzida | **pendente (fase 2, achado aberto)** |
| PII em logs | mascaramento no servidor e no navegador | implantado |
| Erros expondo SQL/tokens | mensagens genéricas ao usuário | implantado |
| Chave privada no cliente | apenas chaves publicáveis no `.env` | implantado |
| Escuta de canais em tempo real de outro usuário | autorização por canal | fase 2 |
| Retenção indefinida de localização precisa | expurgo e redução de precisão fora do atendimento | fase 2 |

### D — Denial of service
| Ameaça | Mitigação | Estado |
|---|---|---|
| Força bruta em login/KYC | limite por usuário/IP com `429` | implantado |
| Abuso de IA e geração de bots | limite por função + exigência de administrador | implantado |
| Payload gigante | limite de corpo e tempo | implantado |
| ReDoS/DoS por dependência | versões corrigidas forçadas | implantado |

### E — Elevation of privilege
| Ameaça | Mitigação | Estado |
|---|---|---|
| Usuário comum vira administrador | papéis em tabela separada, nunca no perfil | implantado |
| Modo simulação por usuário comum | bloqueio na interface e na consulta do banco | implantado |
| IDOR entre serviços/tarefas | predicados de dono nas políticas e funções | implantado (auditoria completa na fase 2) |
| Escalada via view `SECURITY DEFINER` | revisão das views expostas | **pendente (fase 2, achado aberto)** |

## Riscos aceitos no momento

- Limite de chamadas é por instância da função (melhor esforço); a versão persistente
  em banco entra na fase 2.
- `frame-ancestors` não é aplicável via `<meta>`; a proteção contra enquadramento
  depende de cabeçalho na hospedagem.
- Itens de infraestrutura (mTLS, HSM, SIEM, pós-quântico, MPC/Solana) permanecem como
  arquitetura-alvo, descritos em `SECURITY.md`.
