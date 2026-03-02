import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get user from auth header
  const authHeader = req.headers.get("Authorization");
  let userId: string | null = null;
  if (authHeader) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id || null;
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // Activate subscription & generate commission
    if (action === "activate-subscription" && req.method === "POST") {
      if (!userId) return jsonRes({ error: "Unauthorized" }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, referred_by")
        .eq("user_id", userId)
        .single();

      if (!profile) return jsonRes({ error: "Profile not found" }, 404);

      // Insert subscription
      await supabase.from("subscriptions").insert({
        profile_id: profile.id,
        status: "active",
        amount: 99.0,
      });

      // Generate commission if referred
      if (profile.referred_by) {
        const commission = 99 * 0.3;
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

      return jsonRes({ message: "Subscription activated" });
    }

    // Generate coupon
    if (action === "generate-coupon" && req.method === "POST") {
      if (!userId) return jsonRes({ error: "Unauthorized" }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) return jsonRes({ error: "Profile not found" }, 404);

      const code = Array.from(crypto.getRandomValues(new Uint8Array(3)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: coupon, error } = await supabase
        .from("coupons")
        .insert({
          code,
          value: 99,
          min_value: 300,
          expires_at: expiresAt.toISOString(),
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) return jsonRes({ error: error.message }, 500);
      return jsonRes({ coupon: coupon.code });
    }

    // Get dashboard
    if (action === "dashboard" && req.method === "GET") {
      if (!userId) return jsonRes({ error: "Unauthorized" }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) return jsonRes({ error: "Profile not found" }, 404);

      const { data } = await supabase.rpc("get_affiliate_dashboard", {
        _profile_id: profile.id,
      });

      return jsonRes(data);
    }

    // Get commissions list
    if (action === "commissions" && req.method === "GET") {
      if (!userId) return jsonRes({ error: "Unauthorized" }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) return jsonRes({ error: "Profile not found" }, 404);

      const { data } = await supabase
        .from("commissions")
        .select("id, amount, status, created_at, referred_id, profiles!commissions_referred_id_fkey(display_name)")
        .eq("affiliate_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      return jsonRes(data || []);
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonRes({ error: err.message }, 500);
  }
});

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
