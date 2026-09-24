# Inventário de segredos — 1001Jobs (Etapa 3)

Valores nunca são exibidos. Formato: SECRET — LOCAL — TIPO — RISCO.

| Secret | Local | Tipo | Risco |
|---|---|---|---|
| Chave do Google Maps (navegador) | configuração pública do frontend | API key publicável | Baixo — restringir por domínio (referer) |
| Chave publicável do backend | configuração pública do frontend | chave pública (anon) | Nenhum — pública por design, protegida por RLS |
| Segredos do servidor (Stripe, Resend, IA, cron, bots) | cofre de segredos do backend | chaves privadas | Baixo — nunca aparecem no código |

Varredura (código, funções do servidor, logs): nenhuma chave privada, private key,
webhook secret, JWT secret, credencial de banco, credencial de nuvem ou chave de carteira
Solana/blockchain encontrada em arquivos ou no frontend. Nenhum log imprime tokens/senhas.
Nada precisou ser removido ou migrado.

## Etapa 2 — Ponto de restauração
O histórico de versões do Lovable registra cada alteração e permite restaurar qualquer
estado anterior. Com GitHub conectado, cada alteração vira commit; a branch
`security-hardening/1001jobs` pode ser criada no GitHub e selecionada no editor.
