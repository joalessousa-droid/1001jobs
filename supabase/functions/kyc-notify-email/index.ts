// Envia e-mail de mudança de status do KYC via Resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBJECTS: Record<string, string> = {
  in_review: "Recebemos seus documentos",
  approved: "Sua identidade foi aprovada",
  rejected: "Reenvio de documentos necessário",
  pending: "KYC pendente",
};

function html(status: string, name: string, reason?: string | null) {
  const cta = `<a href="https://jobs1001.lovable.app/perfil/kyc" style="display:inline-block;padding:12px 20px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Acessar KYC</a>`;
  const blocks: Record<string, string> = {
    in_review: `<p>Olá ${name}, recebemos seus documentos e estamos analisando. Você será avisado em até 48h.</p>`,
    approved: `<p>Olá ${name}, sua identidade foi <b>aprovada</b>! Agora você tem acesso completo à plataforma.</p>`,
    rejected: `<p>Olá ${name}, sua verificação foi <b>reprovada</b>.</p>${reason ? `<p><b>Motivo:</b> ${reason}</p>` : ""}<p>Reenvie seus documentos seguindo as orientações abaixo:</p><ul><li>Foto nítida e sem cortes</li><li>Documento dentro da validade</li><li>Selfie com boa iluminação</li></ul>${cta}`,
    pending: `<p>Olá ${name}, complete seu KYC para liberar todos os recursos.</p>${cta}`,
  };
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="color:#2563EB">${SUBJECTS[status] ?? "Atualização do KYC"}</h2>${blocks[status] ?? `<p>Status atual: ${status}</p>`}</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("RESEND_FROM") ?? "Jobs1001 <onboarding@resend.dev>";

    const payload = await req.json();
    const { submission_id, alert, alert_type, alert_details } = payload ?? {};
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Alert path: notifica admins por e-mail quando o Serpro esgota retries/timeout
    if (alert) {
      const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      const emails: string[] = [];
      for (const uid of ids) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) emails.push(u.user.email);
      }
      const subjectA = `[Alerta KYC] Serpro retries esgotados (${alert_type ?? "unknown"})`;
      const bodyA = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="color:#b91c1c">Alerta de auto-reprocess</h2>
        <p>O cpf-check esgotou as tentativas configuradas para a submissão <b>${submission_id}</b>.</p>
        <pre style="background:#f1f5f9;padding:12px;border-radius:8px">${JSON.stringify(alert_details ?? {}, null, 2)}</pre>
        <p><a href="https://jobs1001.lovable.app/admin/kyc">Abrir AdminKyc</a></p>
      </div>`;
      if (RESEND_KEY && emails.length > 0) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({ from: FROM, to: emails, subject: subjectA, html: bodyA }),
        }).catch(() => {});
      }
      return new Response(JSON.stringify({ ok: true, alert: true, recipients: emails.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: sub } = await admin.from("kyc_submissions")
      .select("id, status, rejection_reason, user_id, profile_id").eq("id", submission_id).maybeSingle();
    if (!sub) {
      return new Response(JSON.stringify({ error: "submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: prof } = await admin.from("profiles")
      .select("full_name, display_name").eq("id", sub.profile_id).maybeSingle();
    const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id);
    const to = authUser?.user?.email;
    if (!to) {
      return new Response(JSON.stringify({ error: "no recipient email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insere notificação in-app (independente do envio de e-mail).
    const NOTIF_TITLES: Record<string, string> = {
      in_review: "KYC em análise",
      approved: "KYC aprovado",
      rejected: "KYC reprovado",
      pending: "KYC pendente",
    };
    const NOTIF_MESSAGES: Record<string, string> = {
      in_review: "Recebemos seus documentos. Você será notificado em até 48h.",
      approved: "Sua identidade foi aprovada. Acesso completo liberado.",
      rejected: sub.rejection_reason
        ? `Reenvio necessário. Motivo: ${sub.rejection_reason}`
        : "Reenvio de documentos necessário.",
      pending: "Complete seu KYC para liberar todos os recursos.",
    };
    await admin.from("notifications").insert({
      profile_id: sub.profile_id,
      type: `kyc_${sub.status}`,
      title: NOTIF_TITLES[sub.status] ?? "Atualização do KYC",
      message: NOTIF_MESSAGES[sub.status] ?? `Status atual: ${sub.status}`,
      link: "/perfil/kyc",
      metadata: { submission_id: sub.id, status: sub.status, rejection_reason: sub.rejection_reason ?? null },
    });

    if (!RESEND_KEY) {
      return new Response(JSON.stringify({ ok: true, in_app: true, email_skipped: "no_resend_key" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const name = prof?.display_name ?? prof?.full_name ?? "";
    const subject = SUBJECTS[sub.status] ?? "Atualização do KYC";
    const body = html(sub.status, name, sub.rejection_reason);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, html: body }),
    });
    const out = await r.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: r.ok, in_app: true, email_status: r.status, resend: out }),
      { status: r.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
