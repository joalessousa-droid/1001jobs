import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * 1001 AI LEARNING ENGINE — ciclo periódico.
 * Marca outliers, recalcula correções de preço, detecta anomalias e
 * grava snapshots de inteligência regional. Só admin/moderador ou cron.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SECRET");

  if (!isCron) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isStaff = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "moderator");
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { data: cats } = await admin
      .from("ai_price_observations")
      .select("category")
      .limit(2000);
    const unique = [...new Set((cats ?? []).map((c: { category: string }) => c.category))];

    let flagged = 0;
    for (const c of unique) {
      const { data } = await admin.rpc("ai_flag_outliers", { _category: c });
      flagged += Number(data ?? 0);
    }

    const { data: corrections } = await admin.rpc("ai_refresh_price_corrections");
    const { data: anomalies } = await admin.rpc("ai_detect_anomalies");
    const { data: regional } = await admin.rpc("ai_regional_intelligence", { _days: 30 });

    if (Array.isArray(regional)) {
      for (const r of regional as Record<string, unknown>[]) {
        await admin.from("ai_regional_stats").upsert(
          {
            level: "city",
            scope_value: String(r.city ?? "—"),
            category: null,
            period_days: 30,
            metrics: r,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "level,scope_value,category,period_days" },
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        categories: unique.length,
        outliers_flagged: flagged,
        corrections: corrections ?? 0,
        anomalies: anomalies ?? 0,
        regions: Array.isArray(regional) ? regional.length : 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
