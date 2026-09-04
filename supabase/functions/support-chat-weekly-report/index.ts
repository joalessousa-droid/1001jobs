// Gera o relatório semanal de métricas do chatbot e envia por e-mail (Resend).
// Sempre arquiva o relatório em support_chat_weekly_reports.
// Pode ser disparado manualmente (admin) ou via pg_cron.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { requireCaller } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmt(n: any) {
  if (n === null || n === undefined) return "-";
  if (typeof n === "number") return n.toLocaleString("pt-BR");
  return String(n);
}

function trendArrow(pct: number | null | undefined) {
  if (pct === null || pct === undefined) return "—";
  const sign = pct >= 0 ? "▲" : "▼";
  return `${sign} ${Math.abs(pct).toFixed(1)}%`;
}

function buildHtml(report: any): string {
  const c = report.current ?? {};
  const intents = (report.top_intents ?? []).map((i: any) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${i.intent}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${i.count}</td></tr>`
  ).join("");
  const failures = (report.top_failures ?? []).map((f: any) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${f.status}${f.http_status ? ` (${f.http_status})` : ""}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${(f.sample_error ?? "").toString().slice(0, 120)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${f.count}</td></tr>`
  ).join("");
  const seg = report.by_segment ?? {};
  const segRows = Object.entries(seg).map(([k, v]: [string, any]) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee"><b>${k}</b></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${v.total}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${v.answered}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${v.errors}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${v.p95_response_ms} ms</td></tr>`
  ).join("");

  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0F172A;color:#E2E8F0;padding:24px">
  <div style="max-width:680px;margin:0 auto;background:#111827;border-radius:12px;padding:24px;border:1px solid #1F2937">
    <h1 style="color:#fff;font-size:20px;margin:0 0 6px">📊 Relatório Semanal — Ana (Chatbot 1001Jobs)</h1>
    <p style="color:#94A3B8;margin:0 0 18px">Período: ${new Date(report.period.from).toLocaleDateString("pt-BR")} → ${new Date(report.period.to).toLocaleDateString("pt-BR")}</p>

    <h2 style="color:#fff;font-size:16px;margin:18px 0 8px">Resumo</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:6px 8px;color:#94A3B8">Perguntas totais</td><td style="padding:6px 8px;text-align:right;color:#fff"><b>${fmt(c.total)}</b> (${trendArrow(report.trend_pct)} vs semana anterior)</td></tr>
      <tr><td style="padding:6px 8px;color:#94A3B8">Respondidas com sucesso</td><td style="padding:6px 8px;text-align:right;color:#22c55e">${fmt(c.answered)}</td></tr>
      <tr><td style="padding:6px 8px;color:#94A3B8">Rate-limit (429)</td><td style="padding:6px 8px;text-align:right;color:#f59e0b">${fmt(c.rate_limited_429)}</td></tr>
      <tr><td style="padding:6px 8px;color:#94A3B8">Crédito esgotado (402)</td><td style="padding:6px 8px;text-align:right;color:#ef4444">${fmt(c.credits_exhausted_402)}</td></tr>
      <tr><td style="padding:6px 8px;color:#94A3B8">Erros</td><td style="padding:6px 8px;text-align:right;color:#ef4444">${fmt(c.errors)}</td></tr>
      <tr><td style="padding:6px 8px;color:#94A3B8">Tempo médio / P95</td><td style="padding:6px 8px;text-align:right;color:#fff">${fmt(c.avg_response_ms)} ms · ${fmt(c.p95_response_ms)} ms</td></tr>
      <tr><td style="padding:6px 8px;color:#94A3B8">Sessões / Usuários únicos</td><td style="padding:6px 8px;text-align:right;color:#fff">${fmt(c.unique_sessions)} · ${fmt(c.unique_users)}</td></tr>
    </table>

    <h2 style="color:#fff;font-size:16px;margin:22px 0 8px">Performance por segmento</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="color:#94A3B8;text-align:left"><th style="padding:6px 8px">Segmento</th><th style="padding:6px 8px;text-align:right">Total</th><th style="padding:6px 8px;text-align:right">Sucesso</th><th style="padding:6px 8px;text-align:right">Erros</th><th style="padding:6px 8px;text-align:right">P95</th></tr></thead>
      <tbody>${segRows || `<tr><td colspan="5" style="padding:8px;color:#94A3B8">Sem dados</td></tr>`}</tbody>
    </table>

    <h2 style="color:#fff;font-size:16px;margin:22px 0 8px">Top intenções</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${intents || `<tr><td style="padding:8px;color:#94A3B8">Sem dados</td></tr>`}
    </table>

    <h2 style="color:#fff;font-size:16px;margin:22px 0 8px">Principais falhas</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${failures || `<tr><td style="padding:8px;color:#94A3B8">Sem falhas registradas 🎉</td></tr>`}
    </table>

    <p style="color:#64748B;font-size:11px;margin-top:24px">Gerado em ${new Date(report.generated_at).toLocaleString("pt-BR")} · 1001Jobs</p>
  </div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Só admin/moderador autenticado ou o cron interno podem disparar o relatório.
  const guard = await requireCaller(req, corsHeaders, { requireStaff: true });
  if (!guard.ok) return guard.response;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const allowed = (Deno.env.get("WEEKLY_REPORT_RECIPIENTS") ?? "contato@1001jobs.com")
      .split(",").map((s) => s.trim()).filter(Boolean);
    // Destinatários customizados só são aceitos se estiverem na lista configurada no servidor.
    const requested: string[] = Array.isArray(body?.recipients)
      ? body.recipients.filter((r: unknown) => typeof r === "string" && allowed.includes(r.trim()))
      : [];
    const recipients: string[] = requested.length > 0 ? requested : allowed;

    const { data: report, error: rErr } = await supabase.rpc("get_support_chat_weekly_report");
    if (rErr) throw rErr;

    const subject = `📊 Relatório Semanal Chatbot Ana — ${new Date().toLocaleDateString("pt-BR")}`;
    const html = buildHtml(report);

    let emailStatus = "skipped_no_provider";
    let emailError: string | null = null;

    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (RESEND) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: Deno.env.get("WEEKLY_REPORT_FROM") ?? "Ana Bot <onboarding@resend.dev>",
            to: recipients, subject, html,
          }),
        });
        if (r.ok) emailStatus = "sent";
        else { emailStatus = "failed"; emailError = `${r.status}: ${(await r.text()).slice(0, 300)}`; }
      } catch (e) {
        emailStatus = "failed";
        emailError = e instanceof Error ? e.message : String(e);
      }
    }

    await supabase.from("support_chat_weekly_reports").insert({
      period_from: report.period.from,
      period_to: report.period.to,
      subject, recipients, payload: report,
      email_status: emailStatus,
      email_error: emailError,
    });

    return new Response(JSON.stringify({ ok: true, email_status: emailStatus, recipients, email_error: emailError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
