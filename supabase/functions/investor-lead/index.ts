import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEAM_EMAIL = "ri@jobs1001.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim().slice(0, 200);
    const email = String(body.email ?? "").trim().slice(0, 320);
    const company = String(body.company ?? "").trim().slice(0, 200) || null;
    const message = String(body.message ?? "").trim().slice(0, 5000);

    if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lead, error: dbErr } = await supabase
      .from("investor_leads")
      .insert({ name, email, company, message })
      .select()
      .single();

    if (dbErr) {
      console.error("DB insert error", dbErr);
      return new Response(JSON.stringify({ error: "db_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const html = `
          <h2>Novo lead de Relações com Investidores</h2>
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>E-mail:</strong> ${email}</p>
          <p><strong>Fundo / Empresa:</strong> ${company ?? "—"}</p>
          <p><strong>Mensagem:</strong></p>
          <p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
          <hr/>
          <p style="color:#888;font-size:12px">Lead ID: ${lead.id}</p>
        `;
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "1001JOBS RI <onboarding@resend.dev>",
            to: [TEAM_EMAIL],
            reply_to: email,
            subject: `[RI] Novo contato — ${name}${company ? ` (${company})` : ""}`,
            html,
          }),
        });
        if (!r.ok) console.error("Resend error", await r.text());
      } catch (e) {
        console.error("Email send failed", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, id: lead.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
