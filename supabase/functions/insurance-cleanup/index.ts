// insurance-cleanup: remove anexos vencidos (retention_until < now) do storage e DB.
// Pode ser invocada manualmente por admin ou agendada via cron.
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
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Aplica a política de retenção configurada (recalcula retention_until)
    const { data: policy, error: polErr } = await admin.rpc("apply_insurance_retention_policy");
    if (polErr) throw polErr;

    // 2) Lista anexos cuja retenção expirou
    const limit = 500;
    const { data: rows, error } = await admin.rpc("list_expired_insurance_attachments", { _limit: limit });
    if (error) throw error;
    const list = (rows ?? []) as { attachment_id: string; claim_id: string; file_path: string }[];

    let removed_storage = 0;
    let removed_rows = 0;

    if (list.length > 0) {
      const paths = list.map((r) => r.file_path);
      const { data: rm, error: rmErr } = await admin.storage.from("insurance-claims").remove(paths);
      if (rmErr) {
        console.error("storage remove error", rmErr);
      } else {
        removed_storage = rm?.length ?? 0;
      }

      // purge_insurance_attachments grava event 'retention_purged' por claim na timeline
      const ids = list.map((r) => r.attachment_id);
      const { data: purged, error: pErr } = await admin.rpc("purge_insurance_attachments", { _ids: ids });
      if (pErr) throw pErr;
      removed_rows = Number(purged ?? 0);
    }

    return new Response(JSON.stringify({
      ok: true, policy, examined: list.length, removed_storage, removed_rows,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
