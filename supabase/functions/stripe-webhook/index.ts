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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const profileId = session.metadata?.profile_id;
    const plan = session.metadata?.plan;

    if (!profileId) {
      console.error("No profile_id in session metadata");
      return new Response("Missing profile_id", { status: 400 });
    }

    const amount = (session.amount_total || 0) / 100;

    // Insert subscription
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

      // Update affiliate level
      await supabase.rpc("update_affiliate_level", {
        _profile_id: profile.referred_by,
      });
    }

    console.log(`Subscription activated for ${profileId}, plan: ${plan}, amount: R$${amount}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
