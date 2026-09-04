// Sends transactional emails for dispute events via Resend.
// Triggered from the client right after the dispute action succeeds.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireCaller } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  dispute_id: string;
  event: "opened" | "evidence" | "status_changed" | "resolved";
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireCaller(req, corsHeaders, { requireStaff: false });
  if (!guard.ok) return guard.response;

  try {
    const RESEND = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!RESEND) {
      return new Response(JSON.stringify({ skipped: "no_resend" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.dispute_id || !body?.event) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: dispute } = await admin
      .from("service_disputes")
      .select("id, service_id, status, reason")
      .eq("id", body.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("dispute_not_found");

    const { data: svc } = await admin
      .from("services")
      .select("id, title, client_id, provider_id")
      .eq("id", dispute.service_id)
      .maybeSingle();
    if (!svc) throw new Error("service_not_found");

    const { data: profs } = await admin
      .from("profiles")
      .select("id, display_name, user_id")
      .in("id", [svc.client_id, svc.provider_id]);

    const userIds = (profs ?? []).map((p) => p.user_id);
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    const emailByUser = new Map<string, string>();
    for (const u of usersList?.users ?? []) {
      if (userIds.includes(u.id) && u.email) emailByUser.set(u.id, u.email);
    }

    const subjectMap: Record<Payload["event"], string> = {
      opened: `Disputa aberta — ${svc.title}`,
      evidence: `Nova evidência — ${svc.title}`,
      status_changed: `Status da disputa atualizado — ${svc.title}`,
      resolved: `Disputa resolvida — ${svc.title}`,
    };

    const link = `https://jobs1001.lovable.app/disputa/${dispute.id}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;color:#0f172a">
        <h2 style="margin:0 0 12px">${subjectMap[body.event]}</h2>
        <p style="color:#475569">${body.message ?? "Há uma novidade na disputa do seu serviço."}</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">
            Abrir disputa
          </a>
        </p>
        <p style="font-size:12px;color:#94a3b8">1001JOBS — Marketplace de serviços</p>
      </div>`;

    const sent: string[] = [];
    for (const profile of profs ?? []) {
      const to = emailByUser.get(profile.user_id);
      if (!to) continue;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "1001JOBS <onboarding@resend.dev>",
          to: [to],
          subject: subjectMap[body.event],
          html,
        }),
      });
      if (r.ok) sent.push(to);
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
