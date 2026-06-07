// CPF check — algoritmo + provider plugável (Serpro se SERPRO_API_KEY presente).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(s: string) { return (s ?? "").replace(/\D/g, ""); }
function isValidCPF(input: string): boolean {
  const c = onlyDigits(input);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const n = c.split("").map((d) => +d);
  let s = 0; for (let i = 0; i < 9; i++) s += n[i] * (10 - i);
  let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== n[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += n[i] * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === n[10];
}

async function checkSerpro(cpf: string, token: string) {
  try {
    const r = await fetch(`https://gateway.apiserpro.serpro.gov.br/consulta-cpf-df/v1/cpf/${cpf}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { regularidade: "unknown", raw: { status: r.status } };
    const j = await r.json();
    const sit = String(j?.situacao?.codigo ?? "").trim();
    const regularidade = sit === "0" ? "regular" : sit ? "irregular" : "unknown";
    return { regularidade, raw: j };
  } catch (e) {
    return { regularidade: "unknown", raw: { error: (e as Error).message } };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SERPRO = Deno.env.get("SERPRO_API_KEY");
    const { submission_id, cpf } = await req.json();
    const target = onlyDigits(cpf ?? "");

    if (!isValidCPF(target)) {
      const out = { ok: false, valid: false, regularidade: "irregular", provider: "algorithmic" };
      if (submission_id) {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        await admin.from("kyc_submissions").update({
          cpf_valid: false, cpf_regularidade: "irregular", cpf_checked_at: new Date().toISOString(),
        }).eq("id", submission_id);
      }
      return new Response(JSON.stringify(out),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let regularidade: "regular" | "irregular" | "unknown" = "unknown";
    let provider = "algorithmic";
    if (SERPRO) {
      const r = await checkSerpro(target, SERPRO);
      regularidade = r.regularidade as any;
      provider = "serpro";
    }

    if (submission_id) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      await admin.from("kyc_submissions").update({
        cpf_valid: true, cpf_regularidade: regularidade, cpf_checked_at: new Date().toISOString(),
      }).eq("id", submission_id);
    }

    return new Response(JSON.stringify({ ok: true, valid: true, regularidade, provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
