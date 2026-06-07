// Sends a synthetic alert event to a configured webhook, signs it with the
// current HMAC secret, measures latency and records the attempt in
// eta_alert_deliveries so it shows up in the audit dashboard.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacSha256(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // Verify admin
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await userClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const webhookId: string | undefined = body.webhook_id;
  if (!webhookId) return json({ error: "webhook_id required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: hook, error: hookErr } = await admin
    .from("eta_alert_webhooks").select("*").eq("id", webhookId).maybeSingle();
  if (hookErr || !hook) return json({ error: "webhook_not_found" }, 404);

  const payload = {
    test: true,
    alert_type: "persistent_degradation",
    severity: "high",
    period_from: new Date(Date.now() - 15 * 60_000).toISOString(),
    period_to: new Date().toISOString(),
    city: "TEST_CITY",
    summary: {
      window_min: 15,
      samples: 42,
      failures: 12,
      failure_rate: 0.2857,
      avg_duration_ms: 1850,
      p95_duration_ms: 4200,
      avg_traffic_factor: 1.6,
    },
    triggered_by: userData.user.email ?? userData.user.id,
    dashboard_url: (Deno.env.get("APP_BASE_URL") ?? "") + "/admin/eta",
  };
  const bodyStr = JSON.stringify(payload);

  let signature: string | null = null;
  let signatureNext: string | null = null;
  if (hook.secret) signature = await hmacSha256(String(hook.secret), bodyStr);
  if (hook.secret_next && (!hook.secret_next_activates_at || new Date(hook.secret_next_activates_at) > new Date())) {
    signatureNext = await hmacSha256(String(hook.secret_next), bodyStr);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Test": "true",
    ...(hook.headers ?? {}),
  };
  if (signature) {
    headers["X-Webhook-Signature"] = `sha256=${signature}`;
    headers["X-Webhook-Algorithm"] = "hmac-sha256";
    headers["X-Webhook-Timestamp"] = String(Math.floor(Date.now() / 1000));
  }
  if (signatureNext) headers["X-Webhook-Signature-Next"] = `sha256=${signatureNext}`;

  const t0 = performance.now();
  let httpStatus: number | null = null;
  let responsePreview = "";
  let errorMsg: string | null = null;
  try {
    const res = await fetch(hook.url, { method: "POST", headers, body: bodyStr });
    httpStatus = res.status;
    responsePreview = (await res.text().catch(() => "")).slice(0, 500);
  } catch (e) {
    errorMsg = (e as Error)?.message ?? "network_error";
  }
  const durationMs = Math.round(performance.now() - t0);

  // Record in deliveries (no alert_id since this is a test → use NULL via metadata)
  const { data: delivery } = await admin.from("eta_alert_deliveries").insert({
    alert_id: null,
    channel: "webhook",
    target: hook.url,
    target_label: `[TEST] ${hook.name}`,
    status: httpStatus && httpStatus < 400 ? "sent" : "failed",
    http_status: httpStatus,
    attempts: 1,
    last_error: errorMsg,
    first_attempt_at: new Date(Date.now() - durationMs).toISOString(),
    last_attempt_at: new Date().toISOString(),
    signature,
    signature_algo: signature ? "hmac-sha256" : null,
    webhook_id: hook.id,
    webhook_version: hook.version,
    payload_size: bodyStr.length,
    hmac_validated: signature
      ? httpStatus !== null && httpStatus < 400
      : null,
    hmac_validation_error: signature && httpStatus && httpStatus >= 400
      ? `endpoint returned ${httpStatus}`
      : null,
    hmac_validated_at: signature ? new Date().toISOString() : null,
    metadata: { test: true, triggered_by: userData.user.id },
  }).select().single();

  return json({
    ok: httpStatus !== null && httpStatus < 400,
    http_status: httpStatus,
    duration_ms: durationMs,
    payload_size: bodyStr.length,
    signature,
    signature_next: signatureNext,
    signature_algo: signature ? "hmac-sha256" : null,
    error: errorMsg,
    response_preview: responsePreview,
    delivery_id: delivery?.id ?? null,
    webhook_version: hook.version,
  });
});
