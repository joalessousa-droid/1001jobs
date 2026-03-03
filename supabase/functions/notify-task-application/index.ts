import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotifyPayload {
  application_id: string;
  new_status: string;
  applicant_profile_id: string;
  task_owner_profile_id: string;
  task_description: string;
}

const STATUS_SUBJECTS: Record<string, string> = {
  accepted: "🎉 Sua candidatura foi aceita!",
  rejected: "❌ Sua candidatura foi rejeitada",
  completed: "✅ Tarefa concluída!",
};

function buildHtml(payload: NotifyPayload, recipientType: "applicant" | "owner", recipientName: string, otherName: string): string {
  const { new_status, task_description } = payload;
  const subject = STATUS_SUBJECTS[new_status] || "Atualização de candidatura";

  const messages: Record<string, Record<string, string>> = {
    accepted: {
      applicant: `Parabéns, <b>${recipientName}</b>! Sua candidatura foi aceita por <b>${otherName}</b>.`,
      owner: `Você aceitou a candidatura de <b>${otherName}</b>.`,
    },
    rejected: {
      applicant: `Olá, <b>${recipientName}</b>. Infelizmente sua candidatura foi rejeitada por <b>${otherName}</b>.`,
      owner: `Você rejeitou a candidatura de <b>${otherName}</b>.`,
    },
    completed: {
      applicant: `A tarefa com <b>${otherName}</b> foi marcada como concluída!`,
      owner: `Você marcou a tarefa com <b>${otherName}</b> como concluída!`,
    },
  };

  const intro = messages[new_status]?.[recipientType] || "Houve uma atualização na sua candidatura.";

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#ffffff">
      <h2 style="color:#1a1a1a;margin-bottom:16px">${subject}</h2>
      <p style="color:#444;line-height:1.6">${intro}</p>
      <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0">
        <p style="color:#888;font-size:12px;margin:0 0 4px">Descrição da tarefa:</p>
        <p style="color:#1a1a1a;margin:0">${task_description}</p>
      </div>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#888;font-size:12px;margin:0">— 1001JOBS</p>
    </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: NotifyPayload = await req.json();

    // Get profiles to find user_ids
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, user_id, display_name")
      .in("id", [payload.applicant_profile_id, payload.task_owner_profile_id]);

    if (!profiles || profiles.length === 0) throw new Error("Profiles not found");

    const applicantProfile = profiles.find((p: any) => p.id === payload.applicant_profile_id);
    const ownerProfile = profiles.find((p: any) => p.id === payload.task_owner_profile_id);

    if (!applicantProfile || !ownerProfile) throw new Error("Could not find both profiles");

    // Resolve emails
    const [applicantAuth, ownerAuth] = await Promise.all([
      adminClient.auth.admin.getUserById(applicantProfile.user_id),
      adminClient.auth.admin.getUserById(ownerProfile.user_id),
    ]);

    const applicantEmail = applicantAuth.data?.user?.email;
    const ownerEmail = ownerAuth.data?.user?.email;
    const subject = STATUS_SUBJECTS[payload.new_status] || "Atualização de candidatura";

    const emails: { to: string; subject: string; html: string }[] = [];

    if (applicantEmail) {
      emails.push({
        to: applicantEmail,
        subject,
        html: buildHtml(payload, "applicant", applicantProfile.display_name, ownerProfile.display_name),
      });
    }
    if (ownerEmail) {
      emails.push({
        to: ownerEmail,
        subject,
        html: buildHtml(payload, "owner", ownerProfile.display_name, applicantProfile.display_name),
      });
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
    console.error("Error sending task application notification:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
