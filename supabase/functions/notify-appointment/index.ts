import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireCaller } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotifyPayload {
  event: "created" | "confirmed" | "cancelled";
  provider_name: string;
  client_name: string;
  provider_user_id: string;
  client_user_id: string;
  scheduled_date: string;
  scheduled_time: string;
  service_name?: string;
  notes?: string;
}

const SUBJECT_MAP: Record<string, string> = {
  created: "Novo agendamento solicitado",
  confirmed: "Agendamento confirmado",
  cancelled: "Agendamento cancelado",
};

function buildHtml(payload: NotifyPayload, recipientType: "provider" | "client"): string {
  const { event, provider_name, client_name, scheduled_date, scheduled_time, service_name, notes } = payload;
  const title = SUBJECT_MAP[event];
  const intro =
    event === "created"
      ? recipientType === "provider"
        ? `<b>${client_name}</b> solicitou um agendamento com você.`
        : `Seu agendamento com <b>${provider_name}</b> foi solicitado.`
      : event === "confirmed"
        ? recipientType === "provider"
          ? `Você confirmou o agendamento com <b>${client_name}</b>.`
          : `<b>${provider_name}</b> confirmou seu agendamento!`
        : recipientType === "provider"
          ? `O agendamento com <b>${client_name}</b> foi cancelado.`
          : `O agendamento com <b>${provider_name}</b> foi cancelado.`;

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#ffffff">
      <h2 style="color:#1a1a1a;margin-bottom:16px">${title}</h2>
      <p style="color:#444;line-height:1.6">${intro}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#888;width:120px">Data</td><td style="padding:8px 0;font-weight:600;color:#1a1a1a">${scheduled_date}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Horário</td><td style="padding:8px 0;font-weight:600;color:#1a1a1a">${scheduled_time}</td></tr>
        ${service_name ? `<tr><td style="padding:8px 0;color:#888">Serviço</td><td style="padding:8px 0;color:#1a1a1a">${service_name}</td></tr>` : ""}
        ${notes ? `<tr><td style="padding:8px 0;color:#888">Observações</td><td style="padding:8px 0;color:#1a1a1a">${notes}</td></tr>` : ""}
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#888;font-size:12px;margin:0">— 1001JOBS</p>
    </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });

  const guard = await requireCaller(req, corsHeaders, { requireStaff: false });
  if (!guard.ok) return guard.response;
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: NotifyPayload = await req.json();

    // Resolve emails from auth.users
    const [providerAuth, clientAuth] = await Promise.all([
      adminClient.auth.admin.getUserById(payload.provider_user_id),
      adminClient.auth.admin.getUserById(payload.client_user_id),
    ]);

    const providerEmail = providerAuth.data?.user?.email;
    const clientEmail = clientAuth.data?.user?.email;

    const subject = SUBJECT_MAP[payload.event] || "Atualização de agendamento";
    const emails: { to: string; subject: string; html: string }[] = [];

    if (providerEmail) {
      emails.push({ to: providerEmail, subject, html: buildHtml(payload, "provider") });
    }
    if (clientEmail) {
      emails.push({ to: clientEmail, subject, html: buildHtml(payload, "client") });
    }

    const results = await Promise.all(
      emails.map((e) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "1001JOBS <onboarding@resend.dev>",
            to: e.to,
            subject: e.subject,
            html: e.html,
          }),
        }).then((r) => r.json())
      )
    );

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending notification:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
