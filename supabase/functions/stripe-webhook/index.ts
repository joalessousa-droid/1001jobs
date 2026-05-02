import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

serve(async (req) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Pagamento de serviço (escrow)
      if (session.metadata?.kind === "service_escrow") {
        const serviceId = session.metadata.service_id;
        const paymentIntentId = (session.payment_intent as string) || null;
        await supabase.from("service_payments").update({
          state: "captured",
          stripe_payment_intent_id: paymentIntentId,
          authorized_at: new Date().toISOString(),
          captured_at: new Date().toISOString(),
        }).eq("stripe_checkout_session_id", session.id);
        console.log(`Service escrow captured for service ${serviceId}`);
        break;
      }

      const profileId = session.metadata?.profile_id;
      const plan = session.metadata?.plan;

      if (!profileId) {
        console.error("No profile_id in session metadata");
        return new Response("Missing profile_id", { status: 400 });
      }

      const amount = (session.amount_total || 0) / 100;

      // Deactivate any previous subscriptions
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("profile_id", profileId)
        .eq("status", "active");

      // Insert new active subscription
      await supabase.from("subscriptions").insert({
        profile_id: profileId,
        status: "active",
        amount,
      });

      // Check for referral and generate commission
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, referred_by")
        .eq("id", profileId)
        .single();

      if (profile?.referred_by) {
        const commission = amount * 0.3;
        await supabase.from("commissions").insert({
          affiliate_id: profile.referred_by,
          referred_id: profile.id,
          amount: commission,
        });
        await supabase.rpc("update_affiliate_level", {
          _profile_id: profile.referred_by,
        });
      }

      console.log(`Subscription activated for ${profileId}, plan: ${plan}, amount: R$${amount}`);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
      const profileId = customer.metadata?.profile_id;

      if (profileId) {
        if (subscription.status === "active") {
          const amount = (subscription.items.data[0]?.price?.unit_amount || 0) / 100;
          await supabase
            .from("subscriptions")
            .update({ status: "active", amount })
            .eq("profile_id", profileId)
            .eq("status", "active");
          console.log(`Subscription updated for ${profileId}`);
        } else if (["canceled", "unpaid", "past_due"].includes(subscription.status)) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("profile_id", profileId)
            .eq("status", "active");
          console.log(`Subscription ${subscription.status} for ${profileId}`);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
      const profileId = customer.metadata?.profile_id;

      if (profileId) {
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("profile_id", profileId)
          .eq("status", "active");
        console.log(`Subscription cancelled for ${profileId}`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
      const profileId = customer.metadata?.profile_id;

      if (profileId) {
        console.log(`Payment failed for ${profileId}`);
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId = charge.payment_intent as string;
      if (piId) {
        const { data: pay } = await supabase
          .from("service_payments")
          .select("service_id, amount")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();
        if (pay) {
          const refunded = (charge.amount_refunded || 0) / 100;
          const isFull = refunded >= Number(pay.amount);
          await supabase.rpc("record_service_refund", {
            _service_id: pay.service_id,
            _amount: refunded,
            _full: isFull,
          });
          console.log(`Refund recorded for service ${pay.service_id} amount ${refunded}`);
        }
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase.from("service_payments").update({
        state: "failed",
        failure_reason: pi.last_payment_error?.message ?? "payment_failed",
      }).eq("stripe_payment_intent_id", pi.id);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
