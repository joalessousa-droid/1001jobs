import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

// Helper: grava entrada de auditoria via SECURITY DEFINER RPC
async function audit(supabase: any, params: {
  service_id?: string | null;
  payment_id?: string | null;
  source: string;
  event_type: string;
  status?: "info" | "success" | "warning" | "error";
  message?: string | null;
  stripe_event_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  payload?: any;
  error_detail?: any;
}) {
  try {
    const { error } = await supabase.rpc("log_service_payment_event", {
      _service_id: params.service_id ?? null,
      _payment_id: params.payment_id ?? null,
      _source: params.source,
      _event_type: params.event_type,
      _status: params.status ?? "info",
      _message: params.message ?? null,
      _stripe_event_id: params.stripe_event_id ?? null,
      _stripe_payment_intent_id: params.stripe_payment_intent_id ?? null,
      _stripe_session_id: params.stripe_session_id ?? null,
      _amount: params.amount ?? null,
      _currency: params.currency ?? null,
      _ip_address: params.ip_address ?? null,
      _user_agent: params.user_agent ?? null,
      _payload: params.payload ?? {},
      _error_detail: params.error_detail ?? null,
    });
    if (error) console.error("[audit] failed to write log:", error);
  } catch (e) {
    console.error("[audit] exception:", e);
  }
}

serve(async (req) => {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  if (!stripeKey || !webhookSecret) {
    await audit(supabase, {
      source: "webhook", event_type: "config.missing", status: "error",
      message: "Stripe not configured", ip_address: ip, user_agent: ua,
    });
    return new Response("Stripe not configured", { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err.message);
    await audit(supabase, {
      source: "webhook", event_type: "signature.failed", status: "error",
      message: `Signature verification failed: ${err.message}`,
      ip_address: ip, user_agent: ua,
      error_detail: { message: err.message },
    });
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`[webhook] received event ${event.id} type=${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.kind === "service_escrow") {
          const serviceId = session.metadata.service_id;
          const paymentIntentId = (session.payment_intent as string) || null;
          const amount = (session.amount_total || 0) / 100;
          const { data: payRow, error: updateErr } = await supabase
            .from("service_payments").update({
              state: "captured",
              stripe_payment_intent_id: paymentIntentId,
              authorized_at: new Date().toISOString(),
              captured_at: new Date().toISOString(),
            })
            .eq("stripe_checkout_session_id", session.id)
            .select("id, service_id")
            .maybeSingle();

          if (updateErr) {
            await audit(supabase, {
              service_id: serviceId, source: "webhook", event_type: event.type, status: "error",
              message: `Failed to capture escrow: ${updateErr.message}`,
              stripe_event_id: event.id, stripe_session_id: session.id,
              stripe_payment_intent_id: paymentIntentId,
              amount, currency: session.currency ?? null,
              payload: { session_id: session.id }, error_detail: updateErr,
              ip_address: ip, user_agent: ua,
            });
          } else {
            await audit(supabase, {
              service_id: serviceId, payment_id: payRow?.id ?? null,
              source: "webhook", event_type: event.type, status: "success",
              message: `Escrow captured for service ${serviceId}`,
              stripe_event_id: event.id, stripe_session_id: session.id,
              stripe_payment_intent_id: paymentIntentId,
              amount, currency: session.currency ?? null,
              payload: { session_id: session.id, metadata: session.metadata },
              ip_address: ip, user_agent: ua,
            });
          }
          console.log(`[webhook] service escrow captured for service ${serviceId}`);
          break;
        }

        const profileId = session.metadata?.profile_id;
        const plan = session.metadata?.plan;
        if (!profileId) {
          console.error("[webhook] no profile_id in session metadata");
          await audit(supabase, {
            source: "webhook", event_type: event.type, status: "error",
            message: "Missing profile_id in subscription session",
            stripe_event_id: event.id, stripe_session_id: session.id,
            payload: { metadata: session.metadata }, ip_address: ip, user_agent: ua,
          });
          return new Response("Missing profile_id", { status: 400 });
        }

        const amount = (session.amount_total || 0) / 100;

        await supabase.from("subscriptions")
          .update({ status: "cancelled" })
          .eq("profile_id", profileId)
          .eq("status", "active");

        await supabase.from("subscriptions").insert({
          profile_id: profileId, status: "active", amount,
        });

        const { data: profile } = await supabase
          .from("profiles").select("id, referred_by").eq("id", profileId).single();

        if (profile?.referred_by) {
          const commission = amount * 0.3;
          await supabase.from("commissions").insert({
            affiliate_id: profile.referred_by,
            referred_id: profile.id,
            amount: commission,
          });
          await supabase.rpc("update_affiliate_level", { _profile_id: profile.referred_by });
        }
        console.log(`[webhook] subscription activated for ${profileId}, plan: ${plan}, amount: R$${amount}`);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        const profileId = customer.metadata?.profile_id;
        if (profileId) {
          if (event.type === "customer.subscription.updated" && subscription.status === "active") {
            const amount = (subscription.items.data[0]?.price?.unit_amount || 0) / 100;
            await supabase.from("subscriptions")
              .update({ status: "active", amount })
              .eq("profile_id", profileId).eq("status", "active");
          } else {
            await supabase.from("subscriptions")
              .update({ status: "cancelled" })
              .eq("profile_id", profileId).eq("status", "active");
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        const profileId = customer.metadata?.profile_id;
        if (profileId) console.log(`[webhook] payment failed for ${profileId}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = charge.payment_intent as string;
        if (piId) {
          const { data: pay } = await supabase
            .from("service_payments")
            .select("id, service_id, amount, currency")
            .eq("stripe_payment_intent_id", piId)
            .maybeSingle();
          if (pay) {
            const refunded = (charge.amount_refunded || 0) / 100;
            const isFull = refunded >= Number(pay.amount);
            const { error: rpcErr } = await supabase.rpc("record_service_refund", {
              _service_id: pay.service_id, _amount: refunded, _full: isFull,
            });
            await audit(supabase, {
              service_id: pay.service_id, payment_id: pay.id,
              source: "webhook", event_type: event.type,
              status: rpcErr ? "error" : "success",
              message: rpcErr
                ? `Refund recording failed: ${rpcErr.message}`
                : `Refund recorded (${isFull ? "full" : "partial"}): ${refunded}`,
              stripe_event_id: event.id, stripe_payment_intent_id: piId,
              amount: refunded, currency: pay.currency,
              payload: { charge_id: charge.id, full: isFull },
              error_detail: rpcErr ?? null, ip_address: ip, user_agent: ua,
            });
            console.log(`[webhook] refund recorded for service ${pay.service_id} amount ${refunded}`);
          } else {
            await audit(supabase, {
              source: "webhook", event_type: event.type, status: "warning",
              message: `Refund event for unknown payment_intent ${piId}`,
              stripe_event_id: event.id, stripe_payment_intent_id: piId,
              payload: { charge_id: charge.id }, ip_address: ip, user_agent: ua,
            });
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const failureReason = pi.last_payment_error?.message ?? "payment_failed";
        const { data: pay } = await supabase
          .from("service_payments").update({
            state: "failed", failure_reason: failureReason,
          }).eq("stripe_payment_intent_id", pi.id).select("id, service_id").maybeSingle();
        await audit(supabase, {
          service_id: pay?.service_id ?? null, payment_id: pay?.id ?? null,
          source: "webhook", event_type: event.type, status: "error",
          message: `Payment failed: ${failureReason}`,
          stripe_event_id: event.id, stripe_payment_intent_id: pi.id,
          amount: (pi.amount || 0) / 100, currency: pi.currency,
          payload: { last_error: pi.last_payment_error ?? null },
          ip_address: ip, user_agent: ua,
        });
        break;
      }

      default:
        console.log(`[webhook] unhandled event type: ${event.type}`);
        await audit(supabase, {
          source: "webhook", event_type: event.type, status: "info",
          message: "Unhandled event type",
          stripe_event_id: event.id, ip_address: ip, user_agent: ua,
        });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[webhook] processing error:", err);
    await audit(supabase, {
      source: "webhook", event_type: event.type ?? "unknown", status: "error",
      message: `Processing error: ${err?.message ?? String(err)}`,
      stripe_event_id: event.id ?? null,
      payload: { type: event?.type }, error_detail: { message: err?.message, stack: err?.stack },
      ip_address: ip, user_agent: ua,
    });
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
