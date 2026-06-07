// CPF check — algoritmo + Serpro com retry/fallback e logs em audit_logs.
// Em instabilidade do Serpro (timeout/5xx/erros), retorna regularidade='unknown'
// e mantém a submissão 'in_review' (não bloqueia nem aprova).
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

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// Tenta Serpro até 3x com backoff. Em qualquer falha => regularidade=unknown.
async function checkSerproWithRetry(cpf: string, token: string) {
  const attempts: any[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    try {
      const r = await fetchWithTimeout(
        `https://gateway.apiserpro.serpro.gov.br/consulta-cpf-df/v1/cpf/${cpf}`,
        { headers: { Authorization: `Bearer ${token}` } },
        4000,
      );
      const ms = Date.now() - t0;
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        const sit = String(j?.situacao?.codigo ?? "").trim();
        const regularidade = sit === "0" ? "regular" : sit ? "irregular" : "unknown";
        attempts.push({ attempt: i + 1, status: r.status, ms, ok: true });
        return { regularidade, provider: "serpro", attempts, raw: j };
      }
      attempts.push({ attempt: i + 1, status: r.status, ms, ok: false });
      // 4xx (exceto 429) não vale a pena re-tentar
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      attempts.push({ attempt: i + 1, error: (e as Error).message, ms: Date.now() - t0 });
    }
    await sleep(300 * Math.pow(2, i)); // 300, 600, 1200
  }
  return { regularidade: "unknown" as const, provider: "serpro", attempts, error: "serpro_unavailable" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SERPRO = Deno.env.get("SERPRO_API_KEY");
    const { submission_id, cpf } = await req.json();
    const target = onlyDigits(cpf ?? "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    async function audit(action: string, details: any) {
      try {
        await admin.from("audit_logs").insert({
          action, entity_type: "kyc_submission", entity_id: submission_id ?? null, details,
        });
      } catch (_e) { /* non-blocking */ }
    }

    if (!isValidCPF(target)) {
      const out = { ok: false, valid: false, regularidade: "irregular", provider: "algorithmic" };
      if (submission_id) {
        await admin.from("kyc_submissions").update({
          cpf_valid: false, cpf_regularidade: "irregular", cpf_checked_at: new Date().toISOString(),
        }).eq("id", submission_id);
      }
      await audit("cpf_check.invalid_algorithmic", { cpf_mask: target.slice(0, 3) + "***" });
      return new Response(JSON.stringify(out),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let regularidade: "regular" | "irregular" | "unknown" = "unknown";
    let provider = "algorithmic";
    let extra: any = null;

    if (SERPRO) {
      const r = await checkSerproWithRetry(target, SERPRO);
      regularidade = r.regularidade as any;
      provider = r.provider;
      extra = { attempts: r.attempts, error: (r as any).error ?? null };
      await audit(
        regularidade === "unknown" ? "cpf_check.serpro_fallback" : "cpf_check.serpro_ok",
        { attempts: r.attempts, regularidade, error: (r as any).error ?? null },
      );
    }

    if (submission_id) {
      // Em fallback (unknown), forçamos volta para 'in_review' para revisão manual.
      const patch: any = {
        cpf_valid: true, cpf_regularidade: regularidade, cpf_checked_at: new Date().toISOString(),
      };
      if (regularidade === "unknown") patch.status = "in_review";
      await admin.from("kyc_submissions").update(patch).eq("id", submission_id);
    }

    return new Response(JSON.stringify({ ok: true, valid: true, regularidade, provider, ...extra }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
