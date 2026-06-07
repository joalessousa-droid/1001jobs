// Scheduled monitor that scans recent eta_metrics and emits alerts (DB row,
// emails via Resend, multi-webhook via eta_alert_webhooks + env list).
// Persists per-recipient delivery status to eta_alert_deliveries with retries.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  aggregate,
  decide,
  webhookMatches,
  renderTemplate,
  buildTemplateContext,
  backoffDelayMs,
  parseEnvWebhookList,
  type MetricSample,
} from "./lib.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const num = (v: string | undefined, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postWithRetry(
  url: string,
  init: RequestInit,
  maxRetries: number,
): Promise<{ ok: boolean; status: number | null; attempts: number; error: string | null }> {
  let attempts = 0;
  let lastError: string | null = null;
  let lastStatus: number | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    attempts++;
    try {
      const res = await fetch(url, init);
      lastStatus = res.status;
      if (res.ok) return { ok: true, status: res.status, attempts, error: null };
      lastError = (await res.text().catch(() => "")).slice(0, 300);
      if (res.status < 500 && res.status !== 429) break; // don't retry 4xx (except 429)
    } catch (e) {
      lastError = (e as Error)?.message ?? "network_error";
    }
    if (i < maxRetries) await sleep(backoffDelayMs(i + 1));
  }
  return { ok: false, status: lastStatus, attempts, error: lastError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const thresholds = {
    windowMin: num(Deno.env.get("ETA_ALERT_WINDOW_MIN"), 15, 5, 120),
    minSamples: num(Deno.env.get("ETA_ALERT_MIN_SAMPLES"), 10, 1, 1000),
    failRateThresh: num(Deno.env.get("ETA_ALERT_FAIL_RATE"), 0.25, 0.05, 0.95),
    p95Thresh: num(Deno.env.get("ETA_ALERT_P95_MS"), 3000, 500, 60000),
    cooldownMin: num(Deno.env.get("ETA_ALERT_COOLDOWN_MIN"), 30, 1, 240),
  };

  const periodFrom = new Date(Date.now() - thresholds.windowMin * 60_000).toISOString();
  const periodTo = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("eta_metrics")
    .select("ts, ok, duration_ms, traffic_factor, traffic_level, region_key, category_id, provider_id")
    .gte("ts", periodFrom);
  if (error) return json({ error: error.message }, 500);

  const samples = (rows ?? []) as MetricSample[];
  const agg = aggregate(samples);

  // Decide pre-cooldown
  if (agg.samples < thresholds.minSamples) {
    return json({ ok: true, skipped: "insufficient_samples", samples: agg.samples });
  }
  const persistent = agg.failureRate > thresholds.failRateThresh;
  const slow = agg.p95 > thresholds.p95Thresh;
  if (!persistent && !slow) {
    return json({ ok: true, status: "healthy", samples: agg.samples, failure_rate: agg.failureRate, p95: agg.p95 });
  }
  const alertType = persistent ? "persistent_degradation" : "slow_responses";

  const since = new Date(Date.now() - thresholds.cooldownMin * 60_000).toISOString();
  const { data: recent } = await admin.from("eta_alerts").select("id").eq("alert_type", alertType).gte("ts", since).limit(1);
  const decision = decide(agg, thresholds, !!(recent && recent.length));
  if (decision.status !== "alert") {
    return json({ ok: true, skipped: decision.status, samples: agg.samples });
  }

  const cityGuess = agg.topRegion?.split("|")[0] ?? null;
  const { data: tuning } = await admin.from("eta_tuning_overrides").select("*").eq("is_active", true);

  const summary = {
    window_min: thresholds.windowMin,
    samples: agg.samples,
    failures: agg.failures,
    failure_rate: Number(agg.failureRate.toFixed(4)),
    avg_duration_ms: agg.avgDur,
    p95_duration_ms: agg.p95,
    avg_traffic_factor: agg.avgTraffic,
    top_cities: agg.topCities,
    top_providers: agg.topProviders,
  };

  const { data: inserted, error: insErr } = await admin.from("eta_alerts").insert({
    alert_type: alertType,
    severity: decision.severity,
    period_from: periodFrom,
    period_to: periodTo,
    city: cityGuess,
    provider_id: agg.topProvider,
    category_id: agg.topCategory,
    samples: agg.samples,
    failures: agg.failures,
    failure_rate: Number(agg.failureRate.toFixed(4)),
    avg_duration_ms: agg.avgDur,
    p95_duration_ms: agg.p95,
    avg_traffic_factor: agg.avgTraffic,
    summary,
    tuning_snapshot: tuning ?? [],
  }).select().single();
  if (insErr) return json({ error: insErr.message }, 500);

  // ---------------- Email (templated) ----------------
  const recipients = (Deno.env.get("ETA_ALERT_EMAIL_TO") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  let emailSent = false;
  let tplRow: any = null;
  let tplVersion: number | null = null;

  if (recipients.length && lovableKey && resendKey) {
    const tplRes = await admin.from("eta_alert_email_templates")
      .select("id, subject, html_body").eq("alert_type", alertType).eq("is_active", true)
      .order("is_default", { ascending: false }).limit(1).maybeSingle();
    tplRow = tplRes.data;
    if (tplRow?.id) {
      const verRes = await admin.from("eta_alert_email_template_versions")
        .select("version").eq("template_id", tplRow.id).order("version", { ascending: false }).limit(1).maybeSingle();
      tplVersion = verRes.data?.version ?? null;
    }
    const ctx = buildTemplateContext({
      alertType, windowMin: thresholds.windowMin, periodFrom, periodTo,
      agg, tuning: tuning ?? [],
      dashboardUrl: (Deno.env.get("APP_BASE_URL") ?? "") + "/admin/eta",
    });
    const subjectTpl = tplRow?.subject ?? "[ETA] {{alert_type}} — {{failure_pct}}% falhas / p95 {{p95_ms}}ms";
    const bodyTpl = tplRow?.html_body ?? "<h2>{{alert_type}}</h2><p>{{failure_pct}}% falhas</p>";
    const subject = renderTemplate(subjectTpl, ctx as any);
    const html = renderTemplate(bodyTpl, ctx as any);
    const emailBodyStr = JSON.stringify({ subject, html });

    for (const to of recipients) {
      const { data: delivery } = await admin.from("eta_alert_deliveries").insert({
        alert_id: inserted.id, channel: "email", target: to, status: "pending",
        first_attempt_at: new Date().toISOString(),
        template_id: tplRow?.id ?? null,
        template_version: tplVersion,
        payload_size: emailBodyStr.length,
      }).select().single();

      const result = await postWithRetry(
        "https://connector-gateway.lovable.dev/resend/emails",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify({
            from: Deno.env.get("ETA_ALERT_EMAIL_FROM") ?? "alerts@onboarding.resend.dev",
            to: [to], subject, html,
          }),
        },
        2,
      );
      if (result.ok) emailSent = true;
      if (delivery) {
        await admin.from("eta_alert_deliveries").update({
          status: result.ok ? "sent" : "failed",
          http_status: result.status,
          attempts: result.attempts,
          last_error: result.error,
          last_attempt_at: new Date().toISOString(),
        }).eq("id", delivery.id);
      }
    }
  }


  // ---------------- Webhooks (table + env list) ----------------
  const { data: hooks } = await admin.from("eta_alert_webhooks").select("*").eq("is_active", true);
  const envHooks = parseEnvWebhookList(Deno.env.get("ETA_ALERT_WEBHOOKS"));
  const legacy = Deno.env.get("ETA_ALERT_WEBHOOK_URL");
  if (legacy) envHooks.push({ name: "legacy-webhook", url: legacy });

  const allHooks = [
    ...(hooks ?? []).filter((h: any) => webhookMatches(h, alertType, decision.severity!)).map((h: any) => ({
      name: h.name, url: h.url, headers: h.headers ?? {}, secret: h.secret,
      maxRetries: h.max_retries ?? 3, source: "table",
    })),
    ...envHooks.map((h) => ({ name: h.name, url: h.url, headers: {}, secret: null, maxRetries: 2, source: "env" })),
  ];

  const payload = {
    alert_id: inserted.id, alert_type: alertType, severity: decision.severity,
    period_from: periodFrom, period_to: periodTo,
    city: cityGuess, provider_id: agg.topProvider, summary,
    dashboard_url: (Deno.env.get("APP_BASE_URL") ?? "") + "/admin/eta",
  };

  let lastWebhookStatus: number | null = null;
  let lastWebhookError: string | null = null;
  const bodyStr = JSON.stringify(payload);

  for (const hook of allHooks) {
    // HMAC-SHA256 signature when a per-recipient secret is configured
    let signature: string | null = null;
    let signatureAlgo: string | null = null;
    if (hook.secret) {
      try {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw", enc.encode(String(hook.secret)),
          { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
        );
        const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(bodyStr));
        signature = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        signatureAlgo = "hmac-sha256";
      } catch (e) {
        console.error("hmac_sign_failed", (e as Error).message);
      }
    }

    const { data: delivery } = await admin.from("eta_alert_deliveries").insert({
      alert_id: inserted.id, channel: "webhook", target: hook.url, target_label: hook.name,
      status: "pending", first_attempt_at: new Date().toISOString(),
      signature, signature_algo: signatureAlgo,
    }).select().single();

    const headers: Record<string, string> = { "Content-Type": "application/json", ...(hook.headers as any) };
    if (signature) {
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
      headers["X-Webhook-Algorithm"] = "hmac-sha256";
      headers["X-Webhook-Timestamp"] = String(Math.floor(Date.now() / 1000));
    }

    const result = await postWithRetry(hook.url, { method: "POST", headers, body: bodyStr }, hook.maxRetries);
    lastWebhookStatus = result.status;
    lastWebhookError = result.error;
    if (delivery) {
      await admin.from("eta_alert_deliveries").update({
        status: result.ok ? "sent" : "failed",
        http_status: result.status,
        attempts: result.attempts,
        last_error: result.error,
        last_attempt_at: new Date().toISOString(),
      }).eq("id", delivery.id);
    }
  }

  await admin.from("eta_alerts").update({
    email_sent: emailSent,
    webhook_status: lastWebhookStatus,
    webhook_error: lastWebhookError,
  }).eq("id", inserted.id);

  return json({
    ok: true,
    alert_id: inserted.id,
    alert_type: alertType,
    severity: decision.severity,
    email_sent: emailSent,
    webhooks_attempted: allHooks.length,
  });
});
