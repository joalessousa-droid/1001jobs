// Chatbot da plataforma 1001Jobs — responde dúvidas sobre uso da plataforma.
// Usa Lovable AI Gateway (sem necessidade de API key extra).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a "Ana", assistente virtual oficial da 1001Jobs — um marketplace brasileiro que conecta clientes a profissionais autônomos para realização de Tarefas (nunca use a palavra "demanda").

Sua missão: tirar dúvidas sobre uso da plataforma de forma clara, breve e amigável, em português do Brasil. Use markdown leve (negrito, listas) quando ajudar.

Conhecimento essencial da plataforma:

**Cadastro e perfis**
- Há dois perfis: Cliente (quem solicita) e Profissional (quem executa).
- O cadastro pede dados pessoais ou de empresa (CPF/CNPJ) e pode incluir KYC (envio de documento) para receber selo de verificação.

**Tarefas (não chamamos de demanda)**
- O Cliente publica uma Tarefa em "Publicar Tarefa" no Dashboard, descrevendo o serviço, categoria e orçamento.
- Profissionais visualizam Tarefas em /buscar e podem se candidatar (uma única candidatura por Tarefa).
- O Cliente avalia as candidaturas/propostas e aceita uma, criando um Serviço.

**Ciclo do Serviço**
- Status: pendente → aceito → em andamento → concluído → confirmado (ou disputado/cancelado).
- O Cliente paga via "Pagar agora" — o valor fica retido (escrow) pela plataforma até o Cliente confirmar a conclusão.
- Quando o Cliente confirma, o pagamento é liberado para o Profissional automaticamente.

**Disputas**
- Se algo der errado, qualquer participante abre uma disputa em /disputa/:id.
- Ambas as partes anexam evidências (PDF/imagem, máx 5 arquivos, 10MB cada).
- Um moderador da equipe revisa e decide: a favor do cliente (reembolso), do profissional (liberação) ou divisão (split).

**Avaliações**
- Sistema bidirecional e duplo-cego: ambos avaliam, e as notas só aparecem após os dois publicarem (ou após 7 dias).

**Chat**
- Há chat em tempo real em /chat para Cliente e Profissional alinharem detalhes do serviço.

**Plano Pro / Afiliados**
- Existe assinatura Pro com benefícios extras e programa de Afiliados (/afiliados) com comissão sobre indicações.

Regras de resposta:
- Seja direta, no máximo 6 linhas quando possível.
- Sempre use o termo "Tarefa", nunca "demanda".
- Se a pergunta for sobre algo fora da plataforma (programação, finanças genéricas, etc.), responda gentilmente que você atende apenas dúvidas sobre o 1001Jobs e sugira contato em contato@1001jobs.com para outros assuntos.
- Se for um problema sério (fraude, cobrança indevida, falha grave), oriente abrir disputa ou escrever para contato@1001jobs.com.
- Nunca invente recursos que não foram descritos acima.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "ai_not_configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trunca histórico para evitar prompt gigante
    const recent = messages.slice(-20).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recent],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas mensagens em pouco tempo. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédito da IA esgotado. Avise a equipe em contato@1001jobs.com." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await response.text();
      console.error("AI gateway error:", response.status, txt);
      return new Response(JSON.stringify({ error: "ai_gateway_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
