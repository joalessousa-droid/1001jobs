// Edge function: Reconhecimento facial via Lovable AI Gemini Vision
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { selfie_base64, context = "login" } = body ?? {};
    if (!selfie_base64 || typeof selfie_base64 !== "string") {
      return new Response(JSON.stringify({ error: "selfie_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["login","payment","withdrawal","sensitive_change","kyc"].includes(context)) {
      return new Response(JSON.stringify({ error: "invalid context" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Baseline = última submissão KYC aprovada com selfie
    const { data: profile } = await admin
      .from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: "profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: kyc } = await admin
      .from("kyc_submissions")
      .select("selfie_path")
      .eq("profile_id", profile.id)
      .eq("status", "approved")
      .not("selfie_path","is",null)
      .order("decided_at", { ascending: false })
      .limit(1).maybeSingle();

    if (!kyc?.selfie_path) {
      // Sem baseline ainda -> registra como erro/review
      await admin.from("face_verification_attempts").insert({
        profile_id: profile.id, user_id: user.id, context,
        decision: "review", notes: "Sem baseline (KYC não aprovado)",
        ip_address: req.headers.get("x-forwarded-for"),
        user_agent: req.headers.get("user-agent"),
      });
      return new Response(JSON.stringify({
        decision: "review", similarity: null,
        message: "Sem foto de referência aprovada. Conclua o KYC primeiro.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Gera URL assinada para baseline e baixa
    const { data: signed } = await admin.storage.from("kyc-docs")
      .createSignedUrl(kyc.selfie_path, 120);
    if (!signed?.signedUrl) throw new Error("baseline url failed");
    const baseRes = await fetch(signed.signedUrl);
    const baseBuf = new Uint8Array(await baseRes.arrayBuffer());
    const baseB64 = btoa(String.fromCharCode(...baseBuf));
    const baseMime = baseRes.headers.get("content-type") ?? "image/jpeg";

    // Chama Lovable AI Gateway (Gemini multimodal)
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um sistema de verificação biométrica facial. Compare as duas imagens e retorne APENAS JSON: {\"similarity\": <0..1>, \"same_person\": <bool>, \"reasoning\": \"<curto>\"}." },
          { role: "user", content: [
            { type: "text", text: "Imagem 1 = referência. Imagem 2 = nova selfie. Mesma pessoa?" },
            { type: "image_url", image_url: { url: `data:${baseMime};base64,${baseB64}` } },
            { type: "image_url", image_url: { url: selfie_base64.startsWith("data:") ? selfie_base64 : `data:image/jpeg;base64,${selfie_base64}` } },
          ]},
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted", decision: "review" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`AI ${aiRes.status}: ${t.slice(0,200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const similarity = Math.max(0, Math.min(1, Number(parsed.similarity ?? 0)));

    let decision: "approved" | "review" | "blocked" = "blocked";
    if (similarity >= 0.80) decision = "approved";
    else if (similarity >= 0.60) decision = "review";

    await admin.from("face_verification_attempts").insert({
      profile_id: profile.id, user_id: user.id, context,
      similarity, decision,
      baseline_path: kyc.selfie_path,
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
      notes: String(parsed.reasoning ?? "").slice(0, 500),
    });

    if (decision === "blocked") {
      await admin.from("notifications").insert({
        profile_id: profile.id,
        type: "security_block",
        title: "Verificação facial bloqueada",
        message: `Tentativa de ${context} bloqueada (similaridade ${(similarity*100).toFixed(0)}%)`,
      });
    }

    return new Response(JSON.stringify({ decision, similarity }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("face-verify error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
