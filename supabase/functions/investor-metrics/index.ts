import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const [providers, clients, services, completed, kpis, cities] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "provider"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "client"),
      supabase.from("services").select("id", { count: "exact", head: true }),
      supabase.from("services").select("agreed_price").eq("status", "completed").not("agreed_price", "is", null),
      supabase.from("investor_kpis").select("*").eq("id", 1).maybeSingle(),
      supabase.from("profiles").select("city").not("city", "is", null),
    ]);

    const completedRows = completed.data ?? [];
    const completedCount = completedRows.length;
    const totalServicesCount = services.count ?? 0;
    const sumGmv = completedRows.reduce((acc: number, r: any) => acc + Number(r.agreed_price ?? 0), 0);
    const computedTicket = completedCount > 0 ? sumGmv / completedCount : 0;
    const computedTaxa = totalServicesCount > 0 ? (completedCount / totalServicesCount) * 100 : 0;
    const computedGmvAnual = sumGmv;
    const computedReceita = sumGmv * 0.12; // take rate estimado 12%

    const uniqueCities = new Set((cities.data ?? []).map((r: any) => (r.city || "").toLowerCase().trim()).filter(Boolean));

    const k = kpis.data ?? {};
    const merged = {
      TOTAL_PRESTADORES: providers.count ?? 0,
      TOTAL_CLIENTES: clients.count ?? 0,
      TOTAL_CIDADES: uniqueCities.size,
      TOTAL_SERVICOS: completedCount,
      TICKET_MEDIO: Number(k.ticket_medio ?? computedTicket) || 0,
      TAXA_CONCLUSAO: Number(k.taxa_conclusao ?? computedTaxa) || 0,
      TEMPO_ACEITE: Number(k.tempo_aceite_seconds ?? 0),
      RECOMPRA: Number(k.recompra ?? 0),
      GMV_ANUAL: Number(k.gmv_anual ?? computedGmvAnual) || 0,
      RECEITA_ANUAL: Number(k.receita_anual ?? computedReceita) || 0,
      updated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(merged), {
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
