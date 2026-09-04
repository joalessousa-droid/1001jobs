// Envia e-mail para todos os admins quando um SOS é acionado e confirma protocolo para o usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireCaller } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireCaller(req, corsHeaders, { requireStaff: false });
  if (!guard.ok) return guard.response;
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("RESEND_FROM") ?? "Jobs1001 <onboarding@resend.dev>";

    const { alert_id } = await req.json();
    if (!alert_id) {
      return new Response(JSON.stringify({ error: "alert_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: alert, error } = await admin.from("emergency_alerts")
      .select("*").eq("id", alert_id).maybeSingle();
    if (error || !alert) {
      return new Response(JSON.stringify({ error: "alert not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sentTo: string[] = [];

    if (RESEND_KEY) {
      // user confirmation
      const { data: u } = await admin.auth.admin.getUserById(alert.user_id);
      const userEmail = u?.user?.email;
      if (userEmail) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM, to: [userEmail],
            subject: `SOS registrado — Protocolo ${alert.protocol}`,
            html: `<div style="font-family:Inter,Arial;max-width:560px;margin:0 auto;padding:24px">
              <h2 style="color:#b91c1c">Seu SOS foi recebido</h2>
              <p>Guarde este protocolo: <b>${alert.protocol}</b></p>
              <p>Disparado em ${new Date(alert.triggered_at).toLocaleString("pt-BR")}.</p>
              <p>A central foi notificada. Em caso de risco iminente, ligue 190.</p>
            </div>`,
          }),
        });
        sentTo.push(userEmail);
      }

      // admin emails
      const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      const emails: string[] = [];
      for (const uid of ids) {
        const { data } = await admin.auth.admin.getUserById(uid);
        if (data?.user?.email) emails.push(data.user.email);
      }
      if (emails.length > 0) {
        const mapsLink = (alert.latitude && alert.longitude)
          ? `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}` : null;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM, to: emails,
            subject: `[SOS] ${alert.protocol} — ${alert.role}`,
            html: `<div style="font-family:Inter,Arial;max-width:560px;margin:0 auto;padding:24px">
              <h2 style="color:#b91c1c">Alerta SOS recebido</h2>
              <p>Protocolo: <b>${alert.protocol}</b></p>
              <p>Usuário: ${alert.user_id} (${alert.role})</p>
              <p>Disparado em: ${new Date(alert.triggered_at).toLocaleString("pt-BR")}</p>
              ${mapsLink ? `<p><a href="${mapsLink}">Abrir no Google Maps</a></p>` : "<p>Sem localização.</p>"}
              <p><a href="https://jobs1001.lovable.app/admin/emergencias">Abrir painel admin</a></p>
            </div>`,
          }),
        });
        sentTo.push(...emails);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent_to: sentTo.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
