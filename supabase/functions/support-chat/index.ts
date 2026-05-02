// Chatbot da plataforma 1001Jobs — responde dúvidas sobre uso da plataforma.
// Usa Lovable AI Gateway (sem necessidade de API key extra).
// Inclui logs e métricas: tempo de resposta, status (429/402/erro), categoria de intenção.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

const MODEL = "google/gemini-3-flash-preview";

// Detecta categoria de intenção a partir da pergunta (heurística por palavras-chave em PT-BR).
function classifyIntent(text: string): string {
  const q = (text || "").toLowerCase();
  const has = (...arr: string[]) => arr.some((w) => q.includes(w));
  if (has("pagamento", "pagar", "escrow", "retido", "reembolso", "estorn", "cobranç", "cobrança", "fatura", "stripe")) return "pagamento";
  if (has("disputa", "reclamaç", "evidência", "evidencia", "moderador")) return "disputa";
  if (has("avaliaç", "estrela", "nota", "review", "duplo-cego", "duplo cego")) return "avaliacao";
  if (has("chat", "mensagem", "conversa")) return "chat";
  if (has("kyc", "documento", "verificaç", "selo", "verificado")) return "kyc_verificacao";
  if (has("cadastro", "registrar", "criar conta", "signup", "sign up", "login", "entrar", "senha")) return "cadastro_login";
  if (has("tarefa", "publicar tarefa", "candidat", "proposta")) return "tarefas";
  if (has("pro", "premium", "assinatura", "plano")) return "plano_pro";
  if (has("afiliad", "indicaç", "comissão", "comissao", "referral")) return "afiliados";
  if (has("perfil", "foto", "bio", "portfólio", "portfolio")) return "perfil";
  if (has("preço", "preco", "valor", "cobrar", "honorário", "honorario")) return "precificacao";
  if (has("cancel", "desistir", "encerr")) return "cancelamento";
  if (has("contato", "suporte", "ajuda", "humano", "atendente")) return "suporte_humano";
  return "outros";
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

async function logEvent(params: {
  sessionId: string | null;
  question: string;
  answerPreview?: string | null;
  intent?: string | null;
  status: "success" | "rate_limited" | "credits_exhausted" | "error" | "invalid_payload" | "ai_not_configured";
  httpStatus: number;
  responseTimeMs: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  isPro?: boolean | null;
}) {
  try {
    const supabase = getServiceClient();
    const meta = { ...(params.metadata ?? {}), is_pro: params.isPro ?? null };
    await supabase.rpc("log_support_chat_event", {
      _session_id: params.sessionId,
      _question: params.question,
      _answer_preview: params.answerPreview ?? null,
      _intent_category: params.intent ?? null,
      _status: params.status,
      _http_status: params.httpStatus,
      _response_time_ms: params.responseTimeMs,
      _model: MODEL,
      _prompt_tokens: null,
      _completion_tokens: null,
      _total_tokens: null,
      _error_message: params.errorMessage ?? null,
      _metadata: meta,
      _ip_address: params.ip ?? null,
      _user_agent: params.userAgent ?? null,
      _user_id: params.userId ?? null,
      _profile_id: null,
    });
    // Atualiza coluna dedicada is_pro (best-effort)
    if (typeof params.isPro === "boolean" && params.sessionId) {
      await supabase
        .from("support_chat_logs")
        .update({ is_pro: params.isPro })
        .eq("session_id", params.sessionId)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    }
  } catch (e) {
    console.error("log_support_chat_event failed:", e);
  }
}

// Verifica se o usuário tem assinatura Pro ativa.
async function checkIsPro(userId: string | null): Promise<boolean | null> {
  if (!userId) return null;
  try {
    const supabase = getServiceClient();
    const { data: prof } = await supabase
      .from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!prof) return false;
    const { data: sub } = await supabase
      .from("subscriptions").select("id")
      .eq("profile_id", prof.id).eq("status", "active").maybeSingle();
    return !!sub;
  } catch { return null; }
}

// Reclassifica usando exemplos de treinamento (correções) por similaridade simples (Jaccard de tokens).
async function classifyWithTraining(question: string, fallback: string): Promise<string> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("support_chat_intent_training")
      .select("question,intent")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data || data.length === 0) return fallback;
    const tok = (s: string) => new Set(
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2),
    );
    const qSet = tok(question);
    if (qSet.size === 0) return fallback;
    let best = { score: 0, intent: fallback };
    for (const ex of data) {
      const exSet = tok(ex.question || "");
      if (exSet.size === 0) continue;
      let inter = 0; for (const w of qSet) if (exSet.has(w)) inter++;
      const union = qSet.size + exSet.size - inter;
      const sc = union === 0 ? 0 : inter / union;
      if (sc > best.score) best = { score: sc, intent: ex.intent };
    }
    return best.score >= 0.5 ? best.intent : fallback;
  } catch { return fallback; }
}

async function getUserIdFromAuth(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return null;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent");
  let sessionId: string | null = null;
  let lastUserMessage = "";
  let intent: string | null = null;
  const userId = await getUserIdFromAuth(req);
  const isPro = await checkIsPro(userId);

  try {
    const body = await req.json();
    const messages = body?.messages;
    sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;

    if (!Array.isArray(messages) || messages.length === 0) {
      const elapsed = Date.now() - startedAt;
      await logEvent({
        sessionId, question: "", status: "invalid_payload", httpStatus: 400,
        responseTimeMs: elapsed, errorMessage: "messages array required",
        ip, userAgent, userId,
      });
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    lastUserMessage = String(lastUser?.content ?? "").slice(0, 2000);
    const heuristicIntent = classifyIntent(lastUserMessage);
    intent = await classifyWithTraining(lastUserMessage, heuristicIntent);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      const elapsed = Date.now() - startedAt;
      await logEvent({
        sessionId, question: lastUserMessage, intent, status: "ai_not_configured",
        httpStatus: 503, responseTimeMs: elapsed, errorMessage: "LOVABLE_API_KEY missing",
        ip, userAgent, userId,
      });
      return new Response(JSON.stringify({ error: "ai_not_configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recent = messages.slice(-20).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recent],
        stream: true,
      }),
    });

    if (!response.ok) {
      const elapsed = Date.now() - startedAt;
      if (response.status === 429) {
        await logEvent({
          sessionId, question: lastUserMessage, intent, status: "rate_limited",
          httpStatus: 429, responseTimeMs: elapsed, ip, userAgent, userId,
        });
        return new Response(
          JSON.stringify({ error: "Muitas mensagens em pouco tempo. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        await logEvent({
          sessionId, question: lastUserMessage, intent, status: "credits_exhausted",
          httpStatus: 402, responseTimeMs: elapsed, ip, userAgent, userId,
        });
        return new Response(
          JSON.stringify({ error: "Crédito da IA esgotado. Avise a equipe em contato@1001jobs.com." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await response.text();
      console.error("AI gateway error:", response.status, txt);
      await logEvent({
        sessionId, question: lastUserMessage, intent, status: "error",
        httpStatus: response.status, responseTimeMs: elapsed,
        errorMessage: txt.slice(0, 500), ip, userAgent, userId,
      });
      return new Response(JSON.stringify({ error: "ai_gateway_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tee do stream: envia para o cliente em SSE e ao mesmo tempo coleta o texto da resposta para log.
    const [forwardStream, captureStream] = response.body!.tee();

    // Captura assíncrona — não bloqueia retorno.
    (async () => {
      try {
        const reader = captureStream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string") answer += delta;
            } catch { /* ignore */ }
          }
        }
        const elapsed = Date.now() - startedAt;
        await logEvent({
          sessionId, question: lastUserMessage, intent,
          answerPreview: answer.slice(0, 500),
          status: "success", httpStatus: 200, responseTimeMs: elapsed,
          metadata: { answer_length: answer.length },
          ip, userAgent, userId,
        });
      } catch (e) {
        const elapsed = Date.now() - startedAt;
        await logEvent({
          sessionId, question: lastUserMessage, intent,
          status: "error", httpStatus: 500, responseTimeMs: elapsed,
          errorMessage: e instanceof Error ? e.message : String(e),
          ip, userAgent, userId,
        });
      }
    })();

    return new Response(forwardStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    const elapsed = Date.now() - startedAt;
    console.error("support-chat error:", e);
    await logEvent({
      sessionId, question: lastUserMessage, intent: intent ?? null,
      status: "error", httpStatus: 500, responseTimeMs: elapsed,
      errorMessage: e instanceof Error ? e.message : String(e),
      ip, userAgent, userId,
    });
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
