import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MatchRequest {
  mode: "professionals_for_task" | "tasks_for_professional";
  task_id?: string;
  task_description?: string;
  task_category?: string;
  task_city?: string;
  task_budget?: number | null;
  profile_id?: string;
  provider_ids?: string[];
  task_ids?: string[];
}

interface MatchScore {
  id: string;
  score: number;
  reasons: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: MatchRequest = await req.json();

    if (payload.mode === "professionals_for_task") {
      return await matchProfessionalsForTask(adminClient, payload, LOVABLE_API_KEY);
    } else if (payload.mode === "tasks_for_professional") {
      return await matchTasksForProfessional(adminClient, payload, LOVABLE_API_KEY);
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("AI Match error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function matchProfessionalsForTask(
  db: any,
  payload: MatchRequest,
  apiKey: string
) {
  const { task_description, task_category, task_city, task_budget, provider_ids } = payload;

  if (!task_description || !provider_ids || provider_ids.length === 0) {
    return new Response(JSON.stringify({ scores: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch provider details
  const { data: profiles } = await db
    .from("profiles")
    .select("id, display_name, bio, city, state")
    .in("id", provider_ids.slice(0, 20));

  const { data: services } = await db
    .from("provider_services")
    .select("provider_id, hourly_rate, service_categories(name)")
    .in("provider_id", provider_ids.slice(0, 20));

  const { data: reviews } = await db
    .from("reviews")
    .select("reviewed_id, rating")
    .in("reviewed_id", provider_ids.slice(0, 20));

  // Build provider summaries
  const serviceMap = new Map<string, string[]>();
  const rateMap = new Map<string, number[]>();
  (services || []).forEach((s: any) => {
    const cats = serviceMap.get(s.provider_id) || [];
    cats.push(s.service_categories?.name || "");
    serviceMap.set(s.provider_id, cats);
    if (s.hourly_rate) {
      const rates = rateMap.get(s.provider_id) || [];
      rates.push(s.hourly_rate);
      rateMap.set(s.provider_id, rates);
    }
  });

  const reviewMap = new Map<string, { sum: number; count: number }>();
  (reviews || []).forEach((r: any) => {
    const existing = reviewMap.get(r.reviewed_id) || { sum: 0, count: 0 };
    existing.sum += r.rating;
    existing.count += 1;
    reviewMap.set(r.reviewed_id, existing);
  });

  const providerSummaries = (profiles || []).map((p: any) => {
    const cats = serviceMap.get(p.id) || [];
    const rates = rateMap.get(p.id) || [];
    const rev = reviewMap.get(p.id);
    const avgRating = rev ? (rev.sum / rev.count).toFixed(1) : "sem avaliações";
    const minRate = rates.length > 0 ? Math.min(...rates) : null;

    return {
      id: p.id,
      summary: `ID:${p.id}|Nome:${p.display_name}|Bio:${p.bio || "sem bio"}|Local:${p.city || "?"},${p.state || "?"}|Serviços:${cats.join(",")}|Taxa:R$${minRate ?? "?"}/h|Avaliação:${avgRating}`,
    };
  });

  const prompt = `Você é um sistema de matching de profissionais. Analise a compatibilidade entre a tarefa e cada profissional.

TAREFA:
- Descrição: ${task_description}
- Categoria: ${task_category || "não especificada"}
- Cidade: ${task_city || "não especificada"}
- Orçamento: ${task_budget ? `R$ ${task_budget}` : "a combinar"}

PROFISSIONAIS:
${providerSummaries.map((p: any) => p.summary).join("\n")}

Para cada profissional, avalie a compatibilidade (0-100) considerando:
1. Relevância dos serviços oferecidos vs tarefa (peso 40%)
2. Proximidade geográfica (peso 20%)
3. Compatibilidade de preço/orçamento (peso 20%)
4. Avaliações e experiência (peso 20%)`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você avalia compatibilidade entre tarefas e profissionais. Responda SOMENTE com o JSON solicitado." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_scores",
            description: "Return compatibility scores for each professional",
            parameters: {
              type: "object",
              properties: {
                scores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Professional profile ID" },
                      score: { type: "number", description: "Compatibility score 0-100" },
                      reasons: {
                        type: "array",
                        items: { type: "string" },
                        description: "1-2 short reasons for the score in Portuguese",
                      },
                    },
                    required: ["id", "score", "reasons"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["scores"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_scores" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Payment required" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    return new Response(JSON.stringify({ scores: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await response.json();
  let scores: MatchScore[] = [];

  try {
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      scores = parsed.scores || [];
    }
  } catch (e) {
    console.error("Failed to parse AI response:", e);
  }

  return new Response(JSON.stringify({ scores }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function matchTasksForProfessional(
  db: any,
  payload: MatchRequest,
  apiKey: string
) {
  const { profile_id, task_ids } = payload;

  if (!profile_id || !task_ids || task_ids.length === 0) {
    return new Response(JSON.stringify({ scores: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch professional details
  const { data: profile } = await db
    .from("profiles")
    .select("id, display_name, bio, city, state")
    .eq("id", profile_id)
    .single();

  const { data: profServices } = await db
    .from("provider_services")
    .select("hourly_rate, service_categories(name)")
    .eq("provider_id", profile_id);

  // Fetch tasks
  const { data: tasks } = await db
    .from("service_requests")
    .select("id, description, budget, city, state, service_categories(name)")
    .in("id", task_ids.slice(0, 20))
    .eq("is_active", true);

  if (!profile || !tasks || tasks.length === 0) {
    return new Response(JSON.stringify({ scores: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const profCats = (profServices || []).map((s: any) => s.service_categories?.name).filter(Boolean);
  const profRates = (profServices || []).map((s: any) => s.hourly_rate).filter(Boolean);

  const taskSummaries = tasks.map((t: any) =>
    `ID:${t.id}|Desc:${t.description}|Cat:${t.service_categories?.name || "?"}|Local:${t.city || "?"},${t.state || "?"}|Orçamento:${t.budget ? `R$${t.budget}` : "a combinar"}`
  );

  const prompt = `Você é um sistema de matching de tarefas. Analise a compatibilidade entre o profissional e cada tarefa.

PROFISSIONAL:
- Nome: ${profile.display_name}
- Bio: ${profile.bio || "sem bio"}
- Local: ${profile.city || "?"}, ${profile.state || "?"}
- Serviços: ${profCats.join(", ") || "não especificados"}
- Taxa: ${profRates.length > 0 ? `R$ ${Math.min(...profRates)}/h` : "não especificada"}

TAREFAS:
${taskSummaries.join("\n")}

Para cada tarefa, avalie a compatibilidade (0-100) considerando:
1. Relevância dos serviços do profissional vs tarefa (peso 40%)
2. Proximidade geográfica (peso 20%)
3. Compatibilidade de preço/orçamento (peso 20%)
4. Descrição e contexto geral (peso 20%)`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você avalia compatibilidade entre profissionais e tarefas. Responda SOMENTE com o JSON solicitado." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_scores",
            description: "Return compatibility scores for each task",
            parameters: {
              type: "object",
              properties: {
                scores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Task/service request ID" },
                      score: { type: "number", description: "Compatibility score 0-100" },
                      reasons: {
                        type: "array",
                        items: { type: "string" },
                        description: "1-2 short reasons for the score in Portuguese",
                      },
                    },
                    required: ["id", "score", "reasons"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["scores"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_scores" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("AI gateway error:", response.status);
    return new Response(JSON.stringify({ scores: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await response.json();
  let scores: MatchScore[] = [];

  try {
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      scores = parsed.scores || [];
    }
  } catch (e) {
    console.error("Failed to parse AI response:", e);
  }

  // Send email notifications for high-compatibility matches
  const highMatches = scores.filter((s) => s.score >= 85);
  if (highMatches.length > 0) {
    notifyHighMatches(db, profile_id, profile.display_name, highMatches, tasks).catch((e) =>
      console.error("Match notification error:", e)
    );
  }

  return new Response(JSON.stringify({ scores }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function notifyHighMatches(
  db: any,
  profileId: string,
  profileName: string,
  matches: MatchScore[],
  tasks: any[]
) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return;

  // Get professional's email
  const { data: prof } = await db
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .single();
  if (!prof) return;

  const { data: authData } = await db.auth.admin.getUserById(prof.user_id);
  const email = authData?.user?.email;
  if (!email) return;

  const taskMap = new Map(tasks.map((t: any) => [t.id, t]));
  const matchList = matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((m) => {
      const task = taskMap.get(m.id);
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${task?.description?.slice(0, 80) || "Tarefa"}...</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:#16a34a">${m.score}%</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;color:#666">${m.reasons.join("; ")}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#fff">
      <h2 style="color:#1a1a1a;margin-bottom:8px">🎯 Novas tarefas compatíveis encontradas!</h2>
      <p style="color:#555;line-height:1.6">Olá <b>${profileName}</b>, encontramos tarefas com alta compatibilidade com o seu perfil:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left;font-size:13px">Tarefa</th>
            <th style="padding:8px;text-align:center;font-size:13px">Match</th>
            <th style="padding:8px;text-align:left;font-size:13px">Motivo</th>
          </tr>
        </thead>
        <tbody>${matchList}</tbody>
      </table>
      <a href="https://jobs1001.lovable.app/buscar?mode=provider" 
         style="display:inline-block;padding:10px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:8px">
        Ver tarefas
      </a>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#888;font-size:12px">— 1001JOBS</p>
    </div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "1001JOBS <onboarding@resend.dev>",
      to: email,
      subject: `🎯 ${matches.length} tarefa(s) com alta compatibilidade encontrada(s)!`,
      html,
    }),
  });
}
