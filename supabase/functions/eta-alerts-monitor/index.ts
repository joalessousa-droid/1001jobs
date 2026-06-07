// Scheduled monitor that scans recent eta_metrics and emits alerts (DB row,
// optional email via Resend, optional webhook) when persistent_degradation
// thresholds are crossed. Idempotent: respects a per-alert-type cooldown.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const num = (v: string | undefined, d: number, lo: number, hi: number) => {
  const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const windowMin = num(Deno.env.get("ETA_ALERT_WINDOW_MIN"), 15, 5, 120);
  const minSamples = num(Deno.env.get("ETA_ALERT_MIN_SAMPLES"), 10, 1, 1000);
  const failRateThresh = num(Deno.env.get("ETA_ALERT_FAIL_RATE"), 0.25, 0.05, 0.95);
  const p95Thresh = num(Deno.env.get("ETA_ALERT_P95_MS"), 3000, 500, 60000);
  const cooldownMin = num(Deno.env.get("ETA_ALERT_COOLDOWN_MIN"), 30, 1, 240);

  const from = new Date(Date.now() - windowMin * 60_000).toISOString();

  const { data: rows, error } = await admin
    .from("eta_metrics")
    .select("ts, ok, duration_ms, traffic_factor, traffic_level, region_key, category_id, provider_id")
    .gte("ts", from);
  if (error) return json({ error: error.message }, 500);

  const samples = rows ?? [];
  if (samples.length < minSamples) {
    return json({ ok: true, skipped: "insufficient_samples", samples: samples.length });
  }

  const failures = samples.filter((r: any) => !r.ok).length;
  const failureRate = failures / samples.length;
  const durations = samples.filter((r: any) => r.ok && Number.isFinite(r.duration_ms)).map((r: any) => r.duration_ms).sort((a, b) => a - b);
  const p95 = durations.length ? durations[Math.floor(durations.length * 0.95)] : 0;
  const avgDur = durations.length ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length) : 0;
  const tfs = samples.map((r: any) => r.traffic_factor).filter((v: any) => Number.isFinite(v));
  const avgTraffic = tfs.length ? Number((tfs.reduce((s, v) => s + v, 0) / tfs.length).toFixed(3)) : null;

  const persistent = failureRate > failRateThresh;
  const slow = p95 > p95Thresh;
  if (!persistent && !slow) {
    return json({ ok: true, status: "healthy", samples: samples.length, failure_rate: failureRate, p95 });
  }

  const alertType = persistent ? "persistent_degradation" : "slow_responses";

  // Cooldown: skip if same alert_type emitted recently
  const since = new Date(Date.now() - cooldownMin * 60_000).toISOString();
  const { data: recent } = await admin.from("eta_alerts")
    .select("id, ts").eq("alert_type", alertType).gte("ts", since).limit(1);
  if (recent && recent.length > 0) {
    return json({ ok: true, skipped: "cooldown", until: cooldownMin + "min" });
  }

  // Top offending city / provider (most failures)
  const tally = (key: "region_key" | "provider_id") => {
    const m = new Map<string, number>();
    samples.filter((r: any) => !r.ok && r[key]).forEach((r: any) => m.set(r[key], (m.get(r[key]) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const topRegion = tally("region_key");
  const topProvider = tally("provider_id");
  const topCategory = tally("category_id" as any);
  const cityGuess = topRegion?.split("|")[0] ?? null;

  // Snapshot of active tuning overrides (so we know what was in place)
  const { data: tuning } = await admin.from("eta_tuning_overrides")
    .select("*").eq("is_active", true);

  // Persist alert
  const summary = {
    window_min: windowMin, samples: samples.length, failures, failure_rate: Number(failureRate.toFixed(4)),
    avg_duration_ms: avgDur, p95_duration_ms: p95, avg_traffic_factor: avgTraffic,
    top_region: topRegion, top_provider: topProvider,
  };
  const { data: inserted, error: insErr } = await admin.from("eta_alerts").insert({
    alert_type: alertType,
    severity: failureRate > 0.5 ? "critical" : "high",
    period_from: from,
    period_to: new Date().toISOString(),
    city: cityGuess,
    provider_id: topProvider,
    category_id: topCategory,
    samples: samples.length, failures, failure_rate: Number(failureRate.toFixed(4)),
    avg_duration_ms: avgDur, p95_duration_ms: p95, avg_traffic_factor: avgTraffic,
    summary, tuning_snapshot: tuning ?? [],
  }).select().single();
  if (insErr) return json({ error: insErr.message }, 500);

  // Email (Resend via connector gateway)
  const recipients = (Deno.env.get("ETA_ALERT_EMAIL_TO") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  let emailSent = false;
  if (recipients.length && lovableKey && resendKey) {
    try {
      const html = `
        <h2 style="margin:0 0 12px;color:#dc2626">ETA Degradação persistente</h2>
        <p><b>Tipo:</b> ${alertType}<br/><b>Janela:</b> últimos ${windowMin} min</p>
        <ul>
          <li>Amostras: ${samples.length} · Falhas: ${failures} (${(failureRate*100).toFixed(1)}%)</li>
          <li>Latência média: ${avgDur}ms · p95: ${p95}ms</li>
          <li>Fator de trânsito médio: ${avgTraffic ?? "—"}</li>
          <li>Cidade mais afetada: ${cityGuess ?? "—"}</li>
          <li>Provider mais afetado: ${topProvider ?? "—"}</li>
        </ul>
        <p style="color:#64748b;font-size:12px">Gerado em ${new Date().toISOString()}</p>`;
      const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: Deno.env.get("ETA_ALERT_EMAIL_FROM") ?? "alerts@onboarding.resend.dev",
          to: recipients,
          subject: `[ETA] ${alertType} — ${(failureRate*100).toFixed(0)}% falhas / p95 ${p95}ms`,
          html,
        }),
      });
      emailSent = r.ok;
      if (!r.ok) console.error("resend_failed", r.status, await r.text());
    } catch (e) { console.error("email_error", e); }
  }

  // Webhook (optional, e.g. Slack / Discord / internal)
  const webhookUrl = Deno.env.get("ETA_ALERT_WEBHOOK_URL");
  let webhookStatus: number | null = null;
  let webhookError: string | null = null;
  if (webhookUrl) {
    try {
      const w = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: inserted.id, alert_type: alertType, severity: inserted.severity,
          city: cityGuess, provider_id: topProvider, summary,
          dashboard_url: (Deno.env.get("APP_BASE_URL") ?? "") + "/admin/eta",
        }),
      });
      webhookStatus = w.status;
      if (!w.ok) webhookError = (await w.text()).slice(0, 300);
    } catch (e: any) { webhookError = e?.message ?? "webhook_error"; }
  }

  await admin.from("eta_alerts").update({
    email_sent: emailSent, webhook_status: webhookStatus, webhook_error: webhookError,
  }).eq("id", inserted.id);

  return json({ ok: true, alert_id: inserted.id, alert_type: alertType, email_sent: emailSent, webhook_status: webhookStatus });
});
