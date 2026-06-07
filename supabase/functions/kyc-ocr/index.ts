// KYC OCR — extrai dados do documento via Gemini Vision e compara com CPF/nome.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(s: string) { return (s ?? "").replace(/\D/g, ""); }
function norm(s: string) {
  return (s ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, " ");
}
function nameSimilarity(a: string, b: string): number {
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((t) => { if (B.has(t)) inter++; });
  return Math.round((inter / Math.max(A.size, B.size)) * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: sub, error } = await admin.from("kyc_submissions")
      .select("id, profile_id, cpf, doc_front_path").eq("id", submission_id).maybeSingle();
    if (error || !sub) {
      return new Response(JSON.stringify({ error: "submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: prof } = await admin.from("profiles")
      .select("full_name, display_name").eq("id", sub.profile_id).maybeSingle();

    if (!sub.doc_front_path) {
      return new Response(JSON.stringify({ error: "no document" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: signed } = await admin.storage.from("kyc-docs")
      .createSignedUrl(sub.doc_front_path, 300);
    if (!signed?.signedUrl) {
      return new Response(JSON.stringify({ error: "cannot read document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const imgRes = await fetch(signed.signedUrl);
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = `data:${imgRes.headers.get("content-type") ?? "image/jpeg"};base64,${btoa(bin)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Extract Brazilian ID data from the image. Return ONLY a JSON object with keys: name (string), cpf (digits only), rg (string|null), cnh (string|null), birth_date (YYYY-MM-DD|null), doc_type (rg|cnh|other), confidence (0..1). If a field is unreadable, set it to null." },
          { role: "user", content: [
            { type: "text", text: "Extraia os dados deste documento brasileiro." },
            { type: "image_url", image_url: { url: b64 } },
          ]},
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "credits_exhausted" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiRes.ok) {
      return new Response(JSON.stringify({ error: "ai_error", status: aiRes.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    let extracted: any = {};
    try { extracted = JSON.parse(aiJson?.choices?.[0]?.message?.content ?? "{}"); } catch { /* keep empty */ }

    const declaredCpf = onlyDigits(sub.cpf ?? "");
    const ocrCpf = onlyDigits(extracted?.cpf ?? "");
    const ocrCpfMatch = declaredCpf.length === 11 && ocrCpf === declaredCpf;
    const declaredName = prof?.full_name ?? prof?.display_name ?? "";
    const nameMatch = extracted?.name ? nameSimilarity(declaredName, extracted.name) : 0;

    await admin.from("kyc_submissions").update({
      ocr_extracted: extracted,
      ocr_cpf_match: ocrCpfMatch,
      ocr_name_match: nameMatch,
      ocr_checked_at: new Date().toISOString(),
    }).eq("id", submission_id);

    return new Response(JSON.stringify({
      ok: true, extracted, ocr_cpf_match: ocrCpfMatch, ocr_name_match: nameMatch,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
