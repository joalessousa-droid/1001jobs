// Cria sessão de checkout Stripe para pagamento de serviço (escrow).
// O valor é capturado imediatamente e segurado pela plataforma até o cliente
// confirmar o serviço (release_service_payment) ou disputa concluída (refund).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PCT = 0.10; // 10% de taxa da plataforma (registro contábil)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "stripe_not_configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    const authedUserId = userData?.user?.id;
    if (userErr || !authedUserId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { service_id } = await req.json();
    if (!service_id || typeof service_id !== "string") {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    const audit = async (p: Record<string, any>) => {
      try {
        await admin.rpc("log_service_payment_event", {
          _service_id: p.service_id ?? null, _payment_id: p.payment_id ?? null,
          _source: "checkout", _event_type: p.event_type,
          _status: p.status ?? "info", _message: p.message ?? null,
          _stripe_event_id: null,
          _stripe_payment_intent_id: null,
          _stripe_session_id: p.session_id ?? null,
          _amount: p.amount ?? null, _currency: p.currency ?? null,
          _ip_address: ip, _user_agent: ua,
          _payload: p.payload ?? {}, _error_detail: p.error_detail ?? null,
        });
      } catch (e) { console.error("audit error", e); }
    };

    const { data: svc } = await admin
      .from("services")
      .select("id, title, agreed_price, currency, status, payment_status, client_id, provider_id")
      .eq("id", service_id)
      .maybeSingle();
    if (!svc) {
      await audit({ event_type: "checkout.attempt", status: "error", message: "service_not_found", payload: { service_id } });
      throw new Error("service_not_found");
    }

    const { data: clientProfile } = await admin
      .from("profiles").select("user_id, display_name").eq("id", svc.client_id).maybeSingle();
    if (clientProfile?.user_id !== authedUserId) {
      await audit({ service_id: svc.id, event_type: "checkout.forbidden", status: "warning",
        message: "User is not the service client", payload: { attempted_by: authedUserId } });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["accepted", "in_progress"].includes(svc.status)) {
      await audit({ service_id: svc.id, event_type: "checkout.invalid_status", status: "warning",
        message: `Service status not payable: ${svc.status}`, payload: { status: svc.status } });
      return new Response(JSON.stringify({ error: "service_not_payable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (["paid", "released"].includes(svc.payment_status)) {
      await audit({ service_id: svc.id, event_type: "checkout.already_paid", status: "warning",
        message: `Service already in state ${svc.payment_status}`, payload: { payment_status: svc.payment_status } });
      return new Response(JSON.stringify({ error: "already_paid" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!svc.agreed_price || Number(svc.agreed_price) <= 0) {
      await audit({ service_id: svc.id, event_type: "checkout.no_price", status: "error", message: "Missing or invalid price" });
      return new Response(JSON.stringify({ error: "no_price" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const amountCents = Math.round(Number(svc.agreed_price) * 100);
    const fee = +(Number(svc.agreed_price) * PLATFORM_FEE_PCT).toFixed(2);
    const origin = req.headers.get("origin") ?? "https://jobs1001.lovable.app";

    await audit({ service_id: svc.id, event_type: "checkout.attempt", status: "info",
      message: `Creating Stripe Checkout session for service ${svc.id}`,
      amount: Number(svc.agreed_price), currency: svc.currency || "BRL",
      payload: { client_id: svc.client_id, provider_id: svc.provider_id, fee } });

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment", payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: (svc.currency || "BRL").toLowerCase(),
            product_data: {
              name: `Serviço: ${svc.title}`,
              description: "Pagamento retido pela plataforma até confirmação do cliente.",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        success_url: `${origin}/dashboard?tab=services&payment=success&svc=${svc.id}`,
        cancel_url: `${origin}/dashboard?tab=services&payment=cancel&svc=${svc.id}`,
        metadata: {
          kind: "service_escrow",
          service_id: svc.id,
          client_id: svc.client_id,
          provider_id: svc.provider_id,
        },
      });
    } catch (stripeErr: any) {
      await audit({ service_id: svc.id, event_type: "checkout.stripe_error", status: "error",
        message: `Stripe checkout creation failed: ${stripeErr?.message ?? String(stripeErr)}`,
        amount: Number(svc.agreed_price), currency: svc.currency || "BRL",
        error_detail: { message: stripeErr?.message, type: stripeErr?.type } });
      throw stripeErr;
    }

    const { data: payRow } = await admin.from("service_payments").upsert({
      service_id: svc.id,
      client_id: svc.client_id,
      provider_id: svc.provider_id,
      amount: svc.agreed_price,
      currency: svc.currency || "BRL",
      platform_fee: fee,
      stripe_checkout_session_id: session.id,
      state: "pending",
    }, { onConflict: "stripe_checkout_session_id" }).select("id").maybeSingle();

    await audit({ service_id: svc.id, payment_id: payRow?.id ?? null,
      event_type: "checkout.session_created", status: "success",
      message: `Stripe Checkout session created: ${session.id}`,
      amount: Number(svc.agreed_price), currency: svc.currency || "BRL",
      session_id: session.id, payload: { url: session.url } });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("checkout error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

