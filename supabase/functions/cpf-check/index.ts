// CPF check — algoritmo + Serpro com retry/fallback e logs detalhados em audit_logs.
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

type Attempt = {
  attempt: number;
  status?: number;
  latency_ms: number;
  ok: boolean;
  serpro_situacao?: string | null;
  serpro_message?: string | null;
  error?: string | null;
  fallback_reason?: string | null;
};

type SerproCfg = { maxAttempts: number; timeoutMs: number; backoffBaseMs: number };
async function checkSerproWithRetry(cpf: string, token: string, cfg: SerproCfg) {
  const attempts: Attempt[] = [];
  for (let i = 0; i < cfg.maxAttempts; i++) {
    const t0 = Date.now();
    try {
      const r = await fetchWithTimeout(
        `https://gateway.apiserpro.serpro.gov.br/consulta-cpf-df/v1/cpf/${cpf}`,
        { headers: { Authorization: `Bearer ${token}` } },
        cfg.timeoutMs,
      );
      const latency_ms = Date.now() - t0;
      const text = await r.text();
      let j: any = {}; try { j = text ? JSON.parse(text) : {}; } catch { /* keep raw */ }
      if (r.ok) {
        const sit = String(j?.situacao?.codigo ?? "").trim();
        const regularidade = sit === "0" ? "regular" : sit ? "irregular" : "unknown";
        attempts.push({
          attempt: i + 1, status: r.status, latency_ms, ok: true,
          serpro_situacao: sit || null, serpro_message: j?.situacao?.descricao ?? null,
          fallback_reason: regularidade === "unknown" ? "serpro_no_situacao" : null,
        });
        return { regularidade, provider: "serpro" as const, attempts, raw: j };
      }
      const fallback_reason = r.status === 429 ? "serpro_rate_limited"
        : r.status >= 500 ? "serpro_server_error"
        : r.status === 401 || r.status === 403 ? "serpro_auth_error"
        : "serpro_client_error";
      attempts.push({
        attempt: i + 1, status: r.status, latency_ms, ok: false,
        serpro_message: typeof j?.message === "string" ? j.message : text.slice(0, 200),
        fallback_reason,
      });
      if (r.status < 500 && r.status !== 429) break; // não retentar 4xx
    } catch (e) {
      const msg = (e as Error).message || "fetch_failed";
      attempts.push({
        attempt: i + 1, latency_ms: Date.now() - t0, ok: false,
        error: msg, fallback_reason: /abort/i.test(msg) ? "serpro_timeout" : "serpro_network_error",
      });
    }
    await sleep(300 * Math.pow(2, i));
  }
  const last = attempts[attempts.length - 1];
  return {
    regularidade: "unknown" as const, provider: "serpro" as const, attempts,
    error: last?.fallback_reason ?? "serpro_unavailable",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SERPRO = Deno.env.get("SERPRO_API_KEY");
    const body = await req.json().catch(() => ({}));
    const { submission_id, cpf, operator_id, reason: triggerReason } = body ?? {};
    const target = onlyDigits(cpf ?? "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const started = new Date().toISOString();

    async function audit(action: string, details: any) {
      try {
        await admin.from("audit_logs").insert({
          action, entity_type: "kyc_submission", entity_id: submission_id ?? null,
          user_id: operator_id ?? null,
          details: { ...details, started_at: started, trigger_reason: triggerReason ?? null },
        });
      } catch (_e) { /* non-blocking */ }
    }

    if (!isValidCPF(target)) {
      const out = { ok: false, valid: false, regularidade: "irregular", provider: "algorithmic" };
      if (submission_id) {
        await admin.from("kyc_submissions").update({
          cpf_valid: false, cpf_regularidade: "irregular", cpf_checked_at: new Date().toISOString(),
          rejection_category: "cpf_irregular",
        }).eq("id", submission_id);
      }
      await audit("cpf_check.invalid_algorithmic", {
        cpf_mask: target.slice(0, 3) + "***", total_latency_ms: 0, provider: "algorithmic",
        regularidade: "irregular",
      });
      return new Response(JSON.stringify(out),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let regularidade: "regular" | "irregular" | "unknown" = "unknown";
    let provider = "algorithmic";
    let attempts: Attempt[] = [];
    let fallback_reason: string | null = null;
    const totalT0 = Date.now();

    if (SERPRO) {
      const r = await checkSerproWithRetry(target, SERPRO);
      regularidade = r.regularidade;
      provider = r.provider;
      attempts = r.attempts;
      fallback_reason = (r as any).error ?? null;
      // Um registro por tentativa, para auditoria detalhada e exportação por período/cidade
      for (const a of attempts) {
        await audit("cpf_check.serpro_attempt", {
          provider, attempts: [a],
          attempt: a.attempt, status: a.status ?? null,
          latency_ms: a.latency_ms, ok: a.ok,
          serpro_situacao: a.serpro_situacao ?? null,
          serpro_message: a.serpro_message ?? null,
          fallback_reason: a.fallback_reason ?? null,
          error: a.error ?? null,
          cpf_mask: target.slice(0, 3) + "***",
        });
      }
      await audit(
        regularidade === "unknown" ? "cpf_check.serpro_fallback" : "cpf_check.serpro_ok",
        {
          provider, regularidade, attempts,
          total_attempts: attempts.length,
          total_latency_ms: Date.now() - totalT0,
          fallback_reason,
          last_status: attempts[attempts.length - 1]?.status ?? null,
        },
      );
    } else {
      await audit("cpf_check.algorithmic_only", {
        provider: "algorithmic", regularidade: "unknown",
        total_latency_ms: Date.now() - totalT0,
        fallback_reason: "serpro_not_configured",
      });
      fallback_reason = "serpro_not_configured";
    }

    if (submission_id) {
      const patch: any = {
        cpf_valid: true, cpf_regularidade: regularidade, cpf_checked_at: new Date().toISOString(),
      };
      if (regularidade === "unknown") patch.status = "in_review";
      await admin.from("kyc_submissions").update(patch).eq("id", submission_id);
    }

    return new Response(JSON.stringify({
      ok: true, valid: true, regularidade, provider, attempts, fallback_reason,
      total_latency_ms: Date.now() - totalT0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
