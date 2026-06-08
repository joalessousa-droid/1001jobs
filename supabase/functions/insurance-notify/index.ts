// insurance-notify: envia e-mail para claimant e admins em mudanças de status ou comentários.
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

    // Notifica admins in-app (comentário). Status já tem trigger DB para o claimant.
    if (event_type === "comment") {
      const { data: adminRoles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      for (const r of (adminRoles ?? [])) {
        const { data: p } = await admin.from("profiles").select("id").eq("user_id", (r as any).user_id).maybeSingle();
        if (p?.id) {
          await admin.from("notifications").insert({
            profile_id: p.id, type: "insurance_comment_admin",
            title: `Comentário no sinistro ${claim.protocol}`,
            message: String(message ?? "").slice(0, 200),
            link: `/admin/sinistros`,
            metadata: { claim_id },
          });
        }
      }
    }

    const sent: string[] = [];
    if (RESEND_KEY) {
      // claimant email
      const { data: prof } = await admin.from("profiles")
        .select("user_id, full_name").eq("id", claim.claimant_profile_id).maybeSingle();
      const userId = (prof as any)?.user_id;
      let claimantEmail: string | undefined;
      if (userId) {
        const { data: u } = await admin.auth.admin.getUserById(userId);
        claimantEmail = u?.user?.email ?? undefined;
      }
      const subj = event_type === "status_changed"
        ? `Sinistro ${claim.protocol} — status: ${claim.status}`
        : `Sinistro ${claim.protocol} — novo comentário do suporte`;
      const html = `<div style="font-family:Inter,Arial;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#2563EB">${subj}</h2>
        ${message ? `<p>${String(message).slice(0,1000)}</p>` : ""}
        ${claim.resolution_notes ? `<p><b>Notas:</b> ${claim.resolution_notes}</p>` : ""}
        <p><a href="https://jobs1001.lovable.app/seguros/${claim.id}">Abrir sinistro</a></p>
      </div>`;
      if (claimantEmail) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [claimantEmail], subject: subj, html }),
        });
        sent.push(claimantEmail);
      }

      // admins
      const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      const emails: string[] = [];
      for (const uid of ids) {
        const { data } = await admin.auth.admin.getUserById(uid);
        if (data?.user?.email) emails.push(data.user.email);
      }
      if (emails.length > 0) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM, to: emails,
            subject: `[Sinistro] ${claim.protocol} — ${event_type}`,
            html: `${html}<p><a href="https://jobs1001.lovable.app/admin/sinistros">Painel admin</a></p>`,
          }),
        });
        sent.push(...emails);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: sent.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
