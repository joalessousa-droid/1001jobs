// cron-job-monitor: detects pg_cron jobs with repeated failures and notifies admins.
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
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("RESEND_FROM") ?? "Jobs1001 <onboarding@resend.dev>";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: settings } = await admin
      .from("app_settings")
      .select("cron_alert_threshold, cron_alert_window_minutes, cron_alert_cooldown_minutes")
      .limit(1)
      .maybeSingle();
    const threshold = settings?.cron_alert_threshold ?? 3;
    const windowMin = settings?.cron_alert_window_minutes ?? 60;
    const cooldownMin = settings?.cron_alert_cooldown_minutes ?? 60;

    const { data: failures, error } = await admin.rpc("svc_cron_failure_summary", { _window_minutes: windowMin });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alertsToSend = (failures ?? []).filter((f: any) => (f.failure_count ?? 0) >= threshold);
    if (alertsToSend.length === 0) {
      return new Response(JSON.stringify({ ok: true, alerts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: stateRows } = await admin.from("cron_alert_state").select("jobid, last_alert_at");
    const lastByJob = new Map<number, string>((stateRows ?? []).map((r: any) => [Number(r.jobid), r.last_alert_at]));

    const { data: adminRoles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const adminUserIds = (adminRoles ?? []).map((r: any) => r.user_id);
    const adminEmails: string[] = [];
    const adminProfileIds: string[] = [];
    for (const uid of adminUserIds) {
      const { data: p } = await admin.from("profiles").select("id").eq("user_id", uid).maybeSingle();
      if (p?.id) adminProfileIds.push(p.id);
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) adminEmails.push(u.user.email);
    }

    let sent = 0;
    const now = Date.now();
    for (const f of alertsToSend) {
      const last = lastByJob.get(Number(f.jobid));
      if (last && now - new Date(last).getTime() < cooldownMin * 60 * 1000) continue;

      const title = `Job "${f.jobname ?? f.jobid}" falhou ${f.failure_count}x`;
      const msg = `Falhas em ${windowMin} min. Última msg: ${(f.last_message ?? "—").toString().slice(0, 200)}`;

      // in-app
      for (const pid of adminProfileIds) {
        await admin.from("notifications").insert({
          profile_id: pid,
          type: "cron_failure",
          title,
          message: msg,
          link: "/admin/jobs",
          metadata: { jobid: f.jobid, failure_count: f.failure_count, window_minutes: windowMin },
        });
      }

      // email
      if (RESEND_KEY && adminEmails.length) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
            body: JSON.stringify({
              from: FROM,
              to: adminEmails,
              subject: `[ALERTA] ${title}`,
              html: `<h2>${title}</h2><p>${msg}</p><p>Schedule: <code>${f.schedule}</code></p><p><a href="${SUPABASE_URL.replace(".supabase.co", ".lovable.app")}/admin/jobs">Abrir painel</a></p>`,
            }),
          });
        } catch (_) { /* noop */ }
      }

      await admin.rpc("svc_upsert_cron_alert_state", { _jobid: f.jobid, _failure_count: f.failure_count });
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, alerts: sent, evaluated: alertsToSend.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
