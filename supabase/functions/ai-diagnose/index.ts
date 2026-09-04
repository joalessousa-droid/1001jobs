import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DiagnoseRequest {
  text?: string;
  image_base64?: string | null;
  voice_transcription?: string | null;
  location?: { lat: number; lng: number; city?: string | null } | null;
  service_history?: string[];
  categories?: string[];
  answers?: { question: string; answer: string }[];
}

const SYSTEM_PROMPT = `Você é a "1001 AI", assistente de diagnóstico da plataforma 1001Jobs (serviços domésticos e técnicos no Brasil).
Sua função: a partir da descrição (texto, voz e/ou foto) do usuário, identificar o POSSÍVEL problema, a categoria, o profissional recomendado, complexidade, urgência e uma faixa de preço estimada em reais.

REGRAS OBRIGATÓRIAS:
- NUNCA afirme um diagnóstico com certeza. Use "possível problema", "parece ser", "há indícios de".
- Se houver risco (elétrica, gás, incêndio, risco estrutural, vazamento grave, químicos), preencha safety_warnings e oriente a não fazer o reparo sozinho.
- Se a confiança for baixa (< 0.6), NÃO conclua: devolva required_questions com no máximo 2 perguntas objetivas e opções curtas.
- Faça o mínimo de perguntas possível.
- Preços são apenas estimativas iniciais de referência, nunca garantidos.
- Responda sempre em português do Brasil, linguagem simples.
- Escolha "category" preferencialmente entre a lista de categorias disponíveis fornecida.`;

const TOOL = {
  type: "function",
  function: {
    name: "emit_diagnosis",
    description: "Retorna o diagnóstico estruturado do problema do usuário",
    parameters: {
      type: "object",
      properties: {
        problem_detected: { type: "string", description: "Possível problema, em uma frase" },
        summary: { type: "string", description: "Explicação curta e amigável (2-3 frases)" },
        confidence: { type: "number", description: "0 a 1" },
        category: { type: "string" },
        recommended_profession: { type: "string" },
        urgency: { type: "string", enum: ["normal", "prioridade", "urgente"] },
        complexity: { type: "string", enum: ["baixa", "media", "alta"] },
        estimated_price_min: { type: "number" },
        estimated_price_max: { type: "number" },
        required_questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
            },
            required: ["question", "options"],
            additionalProperties: false,
          },
        },
        safety_warnings: { type: "array", items: { type: "string" } },
        reasons: { type: "array", items: { type: "string" } },
      },
      required: [
        "problem_detected",
        "summary",
        "confidence",
        "category",
        "recommended_profession",
        "urgency",
        "complexity",
        "estimated_price_min",
        "estimated_price_max",
        "required_questions",
        "safety_warnings",
        "reasons",
      ],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body: DiagnoseRequest = await req.json();

    const contextLines: string[] = [];
    if (body.text) contextLines.push(`Descrição do usuário: ${body.text}`);
    if (body.voice_transcription) contextLines.push(`Transcrição de voz: ${body.voice_transcription}`);
    if (body.location) {
      contextLines.push(
        `Localização aproximada: ${body.location.city ?? `${body.location.lat.toFixed(2)}, ${body.location.lng.toFixed(2)}`}`,
      );
    }
    if (body.service_history?.length) {
      contextLines.push(`Histórico de serviços do cliente: ${body.service_history.join("; ")}`);
    }
    if (body.categories?.length) {
      contextLines.push(`Categorias disponíveis na plataforma: ${body.categories.join(", ")}`);
    }
    if (body.answers?.length) {
      contextLines.push(
        `Respostas do usuário às perguntas de triagem:\n${body.answers
          .map((a) => `- ${a.question} => ${a.answer}`)
          .join("\n")}`,
      );
      contextLines.push(
        "O usuário já respondeu às perguntas. Se possível, conclua o diagnóstico agora e devolva required_questions vazio.",
      );
    }

    const content: unknown[] = [{ type: "text", text: contextLines.join("\n") || "Sem descrição." }];
    if (body.image_base64) {
      content.push({ type: "image_url", image_url: { url: body.image_base64 } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "emit_diagnosis" } },
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limit" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "payment_required" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      throw new Error("AI gateway error");
    }

    const data = await res.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No diagnosis returned");
    const diagnosis = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ diagnosis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("ai-diagnose error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
