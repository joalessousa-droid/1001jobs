// 1001Pay — status da conta, pagamento de teste e sincronização da carteira.
// Ações:
//  - status:       informa se o gateway está conectado e se está em modo teste
//  - test_payment: cria um serviço de teste e uma sessão de checkout (cartão 4242)
//  - sync:         consulta o Stripe e atualiza os pagamentos pendentes do usuário
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PCT = 0.1;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "status");

    if (!stripeKey) return json({ configured: false, mode: null, error: "stripe_not_configured" }, 200);

    const mode = stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_") ? "test" : "live";
    if (action === "status") return json({ configured: true, mode });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    const uid = userData?.user?.id as string | undefined;
    if (!uid) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: profile } = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("user_id", uid)
      .maybeSingle();
    if (!profile) return json({ error: "profile_not_found" }, 404);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    /* ---------------------------------------------------------- sync ---- */
    if (action === "sync") {
      const { data: pending } = await admin
        .from("service_payments")
        .select("id, service_id, stripe_checkout_session_id, state")
        .or(`provider_id.eq.${profile.id},client_id.eq.${profile.id}`)
        .in("state", ["pending", "authorized"])
        .not("stripe_checkout_session_id", "is", null)
        .limit(20);

      let updated = 0;
      for (const p of pending ?? []) {
        try {
          const session = await stripe.checkout.sessions.retrieve(p.stripe_checkout_session_id!);
          if (session.payment_status === "paid") {
            await admin
              .from("service_payments")
              .update({
                state: "captured",
                stripe_payment_intent_id: (session.payment_intent as string) ?? null,
                authorized_at: new Date().toISOString(),
                captured_at: new Date().toISOString(),
              })
              .eq("id", p.id);
            await admin
              .from("services")
              .update({ payment_status: "paid", updated_at: new Date().toISOString() })
              .eq("id", p.service_id);
            updated++;
          }
        } catch (e) {
          console.error("sync session error", e);
        }
      }
      return json({ ok: true, mode, updated });
    }

    /* -------------------------------------------------- test_payment ---- */
    if (action === "test_payment") {
      if (mode !== "test") return json({ error: "live_mode_blocked", mode }, 400);

      const amount = Math.min(Math.max(Number(body?.amount ?? 50), 5), 500);
      const origin = req.headers.get("origin") ?? "https://jobs1001.lovable.app";

      const { data: svc, error: svcErr } = await admin
        .from("services")
        .insert({
          client_id: profile.id,
          provider_id: profile.id,
          title: "Pagamento de teste 1001Pay",
          description: "Serviço criado automaticamente para validar a carteira em ambiente de teste.",
          price_type: "negotiated",
          agreed_price: amount,
          currency: "BRL",
          status: "accepted",
          payment_status: "pending",
        })
        .select("id")
        .single();
      if (svcErr || !svc) return json({ error: "service_create_failed" }, 500);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: "Pagamento de teste — 1001Pay",
                description: "Ambiente de teste. Use o cartão 4242 4242 4242 4242.",
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/dashboard?tab=agenda&pay1001=success`,
        cancel_url: `${origin}/dashboard?tab=agenda&pay1001=cancel`,
        metadata: {
          kind: "service_escrow",
          service_id: svc.id,
          client_id: profile.id,
          provider_id: profile.id,
        },
      });

      await admin.from("service_payments").upsert(
        {
          service_id: svc.id,
          client_id: profile.id,
          provider_id: profile.id,
          amount,
          currency: "BRL",
          platform_fee: +(amount * PLATFORM_FEE_PCT).toFixed(2),
          stripe_checkout_session_id: session.id,
          state: "pending",
        },
        { onConflict: "stripe_checkout_session_id" },
      );

      return json({ url: session.url, session_id: session.id, service_id: svc.id, mode });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("pay1001 error", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
