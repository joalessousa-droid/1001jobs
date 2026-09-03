// Aplica reembolso Stripe para um pagamento de serviço.
// Apenas admin/moderator. Total ou parcial. Webhook charge.refunded
// atualiza service_payments via record_service_refund.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "stripe_not_configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    const audit = async (p: Record<string, any>) => {
      try {
        await admin.rpc("log_service_payment_event", {
          _service_id: p.service_id ?? null, _payment_id: p.payment_id ?? null,
          _source: "refund", _event_type: p.event_type,
          _status: p.status ?? "info", _message: p.message ?? null,
          _stripe_event_id: null,
          _stripe_payment_intent_id: p.payment_intent_id ?? null,
          _stripe_session_id: null,
          _amount: p.amount ?? null, _currency: p.currency ?? null,
          _ip_address: ip, _user_agent: ua,
          _payload: p.payload ?? {}, _error_detail: p.error_detail ?? null,
        });
      } catch (e) { console.error("audit error", e); }
    };

    const { data: rolesRows } = await admin
      .from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("moderator")) {
      await audit({ event_type: "refund.forbidden", status: "warning",
        message: "Non-admin attempted refund", payload: { user_id: userId, roles } });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { service_id, amount } = await req.json();
    if (!service_id) {
      await audit({ event_type: "refund.invalid_payload", status: "error", message: "Missing service_id" });
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pay } = await admin
      .from("service_payments")
      .select("id, stripe_payment_intent_id, amount, state, currency")
      .eq("service_id", service_id)
      .maybeSingle();
    if (!pay?.stripe_payment_intent_id) {
      await audit({ service_id, event_type: "refund.no_intent", status: "error", message: "No payment intent registered" });
      throw new Error("no_payment_intent");
    }
    if (!["captured", "authorized", "partial_refund"].includes(pay.state)) {
      await audit({ service_id, payment_id: pay.id, event_type: "refund.not_refundable", status: "warning",
        message: `State ${pay.state} not refundable`, payload: { state: pay.state } });
      return new Response(JSON.stringify({ error: "not_refundable", state: pay.state }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await audit({ service_id, payment_id: pay.id, event_type: "refund.attempt", status: "info",
      message: `Admin ${userId} requesting refund`, amount: amount ? Number(amount) : Number(pay.amount),
      currency: pay.currency, payment_intent_id: pay.stripe_payment_intent_id,
      payload: { roles } });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const refundAmount = amount ? Math.round(Number(amount) * 100) : undefined;
    let refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: pay.stripe_payment_intent_id,
        amount: refundAmount,
        metadata: { service_id, requested_by: userId },
      });
    } catch (stripeErr: any) {
      await audit({ service_id, payment_id: pay.id, event_type: "refund.stripe_error", status: "error",
        message: `Stripe refund failed: ${stripeErr?.message ?? String(stripeErr)}`,
        payment_intent_id: pay.stripe_payment_intent_id,
        error_detail: { message: stripeErr?.message, type: stripeErr?.type } });
      throw stripeErr;
    }

    await audit({ service_id, payment_id: pay.id, event_type: "refund.success", status: "success",
      message: `Refund created: ${refund.id} (${refund.status})`,
      amount: amount ? Number(amount) : Number(pay.amount), currency: pay.currency,
      payment_intent_id: pay.stripe_payment_intent_id,
      payload: { refund_id: refund.id, refund_status: refund.status } });

    return new Response(JSON.stringify({ ok: true, refund_id: refund.id, status: refund.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("refund error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

