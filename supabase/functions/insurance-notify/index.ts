// insurance-notify: envia e-mail e in-app respeitando preferências do usuário/admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Prefs = Record<string, boolean>;
const DEFAULTS: Prefs = {
  insurance_status_email: true, insurance_status_inapp: true,
  insurance_comment_email: true, insurance_comment_inapp: true,
  admin_insurance_status_email: true, admin_insurance_status_inapp: true,
  admin_insurance_comment_email: false, admin_insurance_comment_inapp: true,
};

async function loadPrefs(admin: any, profileId: string): Promise<Prefs> {
  const { data } = await admin.from("notification_preferences").select("*").eq("profile_id", profileId).maybeSingle();
  return { ...DEFAULTS, ...(data ?? {}) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("RESEND_FROM") ?? "Jobs1001 <onboarding@resend.dev>";

    const body = await req.json();
    const { claim_id, event_type, message } = body ?? {};
    if (!claim_id || !event_type) {
      return new Response(JSON.stringify({ error: "claim_id and event_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: claim } = await admin.from("insurance_claims")
      .select("id, protocol, status, claimant_profile_id, resolution_notes").eq("id", claim_id).maybeSingle();
    if (!claim) {
      return new Response(JSON.stringify({ error: "claim not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isComment = event_type === "comment" || event_type === "comment_added";
    const userKeyEmail = isComment ? "insurance_comment_email" : "insurance_status_email";
    const userKeyInApp = isComment ? "insurance_comment_inapp" : "insurance_status_inapp";
    const adminKeyEmail = isComment ? "admin_insurance_comment_email" : "admin_insurance_status_email";
    const adminKeyInApp = isComment ? "admin_insurance_comment_inapp" : "admin_insurance_status_inapp";

    // ----- Notifica admins in-app conforme preferência -----
    const { data: adminRoles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const adminUserIds = (adminRoles ?? []).map((r: any) => r.user_id);
    const adminProfileEmails: Array<{ email: string; prefs: Prefs }> = [];

    for (const uid of adminUserIds) {
      const { data: p } = await admin.from("profiles").select("id").eq("user_id", uid).maybeSingle();
      if (!p?.id) continue;
      const prefs = await loadPrefs(admin, p.id);
      if (prefs[adminKeyInApp]) {
        await admin.from("notifications").insert({
          profile_id: p.id,
          type: isComment ? "insurance_comment_admin" : "insurance_status_admin",
          title: `Sinistro ${claim.protocol} — ${isComment ? "novo comentário" : claim.status}`,
          message: String(message ?? "").slice(0, 200),
          link: `/admin/seguros`,
          metadata: { claim_id },
        });
      }
      if (prefs[adminKeyEmail]) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) adminProfileEmails.push({ email: u.user.email, prefs });
      }
    }

    // ----- Notifica claimant in-app conforme preferência -----
    const claimantPrefs = await loadPrefs(admin, claim.claimant_profile_id);
    if (claimantPrefs[userKeyInApp]) {
      await admin.from("notifications").insert({
        profile_id: claim.claimant_profile_id,
        type: isComment ? "insurance_comment" : "insurance_status",
        title: `Sinistro ${claim.protocol}`,
        message: isComment
          ? String(message ?? "").slice(0, 200)
          : `Status: ${claim.status}`,
        link: `/seguros/${claim.id}`,
        metadata: { claim_id },
      });
    }

    const sent: string[] = [];
    if (RESEND_KEY) {
      const subj = !isComment
        ? `Sinistro ${claim.protocol} — status: ${claim.status}`
        : `Sinistro ${claim.protocol} — novo comentário`;
      const html = `<div style="font-family:Inter,Arial;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#2563EB">${subj}</h2>
        ${message ? `<p>${String(message).slice(0, 1000)}</p>` : ""}
        ${claim.resolution_notes ? `<p><b>Notas:</b> ${claim.resolution_notes}</p>` : ""}
        <p><a href="https://jobs1001.lovable.app/seguros/${claim.id}">Abrir sinistro</a></p>
      </div>`;

      // claimant email
      if (claimantPrefs[userKeyEmail]) {
        const { data: prof } = await admin.from("profiles")
          .select("user_id").eq("id", claim.claimant_profile_id).maybeSingle();
        const cuid = (prof as any)?.user_id;
        if (cuid) {
          const { data: u } = await admin.auth.admin.getUserById(cuid);
          const email = u?.user?.email;
          if (email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from: FROM, to: [email], subject: subj, html }),
            });
            sent.push(email);
          }
        }
      }

      // admin emails (já filtrados pela preferência)
      const adminEmails = adminProfileEmails.map((x) => x.email);
      if (adminEmails.length > 0) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM, to: adminEmails,
            subject: `[Sinistro] ${claim.protocol} — ${event_type}`,
            html: `${html}<p><a href="https://jobs1001.lovable.app/admin/seguros">Painel admin</a></p>`,
          }),
        });
        sent.push(...adminEmails);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: sent.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
