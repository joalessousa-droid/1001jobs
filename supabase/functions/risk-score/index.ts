import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RiskFactor {
  code: string;
  label: string;
  points: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { fingerprint, geo } = body;

    // Use service role for cross-user queries
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get user's profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, cpf_cnpj, person_type, state, city, created_at, user_type")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save fingerprint
    const fpData = {
      profile_id: profile.id,
      user_id: user.id,
      fingerprint_hash: fingerprint.fingerprint_hash,
      ip_address: geo?.ip || null,
      user_agent: fingerprint.user_agent,
      platform: fingerprint.platform,
      language: fingerprint.language,
      timezone: fingerprint.timezone,
      screen_resolution: fingerprint.screen_resolution,
      color_depth: fingerprint.color_depth,
      touch_support: fingerprint.touch_support,
      webgl_renderer: fingerprint.webgl_renderer,
      canvas_hash: fingerprint.canvas_hash,
      city_geo: geo?.city || null,
      state_geo: geo?.region || null,
      country_geo: geo?.country || null,
      latitude_geo: geo?.lat || null,
      longitude_geo: geo?.lon || null,
    };

    await adminClient.from("device_fingerprints").insert(fpData);

    // =====================
    // RISK SCORING ENGINE
    // =====================
    const factors: RiskFactor[] = [];

    // 1. Check if fingerprint was used by other accounts
    const { data: existingFps } = await adminClient
      .from("device_fingerprints")
      .select("user_id")
      .eq("fingerprint_hash", fingerprint.fingerprint_hash)
      .neq("user_id", user.id);

    const uniqueUsers = new Set((existingFps || []).map((f: any) => f.user_id));
    if (uniqueUsers.size > 0) {
      const pts = Math.min(uniqueUsers.size * 15, 40);
      factors.push({
        code: "MULTI_ACCOUNT_DEVICE",
        label: `Dispositivo usado por ${uniqueUsers.size} outra(s) conta(s)`,
        points: pts,
      });
    }

    // 2. Check if IP was used by other accounts
    if (geo?.ip) {
      const { data: ipFps } = await adminClient
        .from("device_fingerprints")
        .select("user_id")
        .eq("ip_address", geo.ip)
        .neq("user_id", user.id);

      const uniqueIpUsers = new Set((ipFps || []).map((f: any) => f.user_id));
      if (uniqueIpUsers.size > 0) {
        const pts = Math.min(uniqueIpUsers.size * 10, 30);
        factors.push({
          code: "MULTI_ACCOUNT_IP",
          label: `IP compartilhado com ${uniqueIpUsers.size} outra(s) conta(s)`,
          points: pts,
        });
      }
    }

    // 3. Check if device was previously blocked
    if (fingerprint.fingerprint_hash) {
      const { data: blocked } = await adminClient
        .from("device_fingerprints")
        .select("id")
        .eq("fingerprint_hash", fingerprint.fingerprint_hash)
        .eq("is_blocked", true)
        .limit(1);

      if (blocked && blocked.length > 0) {
        factors.push({
          code: "BLOCKED_DEVICE",
          label: "Dispositivo previamente bloqueado",
          points: 40,
        });
      }
    }

    // 4. Geographic mismatch (IP state vs profile state)
    if (geo?.region && profile.state) {
      const geoState = geo.region.toUpperCase().trim();
      const profileState = profile.state.toUpperCase().trim();
      // Simple check - both should be state abbreviations or names
      if (geoState !== profileState && !geoState.includes(profileState) && !profileState.includes(geoState)) {
        factors.push({
          code: "GEO_MISMATCH",
          label: `IP em ${geo.region} mas endereço em ${profile.state}`,
          points: 15,
        });
      }
    }

    // 5. Account age check (profile just created = slight risk)
    const profileAge = Date.now() - new Date(profile.created_at).getTime();
    const hoursOld = profileAge / (1000 * 60 * 60);
    if (hoursOld < 0.1) { // less than 6 min (brand new)
      factors.push({
        code: "VERY_NEW_ACCOUNT",
        label: "Conta recém criada",
        points: 5,
      });
    }

    // 6. Check for many signup attempts (multiple fingerprints from same device in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentFps } = await adminClient
      .from("device_fingerprints")
      .select("id")
      .eq("fingerprint_hash", fingerprint.fingerprint_hash)
      .gte("created_at", oneDayAgo);

    if (recentFps && recentFps.length > 3) {
      factors.push({
        code: "MANY_SIGNUP_ATTEMPTS",
        label: `${recentFps.length} tentativas de cadastro em 24h`,
        points: Math.min((recentFps.length - 3) * 10, 25),
      });
    }

    // 7. CPF/CNPJ recently issued check (PJ with data_abertura < 3 months)
    if (profile.person_type === "juridica") {
      // Check via metadata if we have data_abertura
      const { data: fullProfile } = await adminClient
        .from("profiles")
        .select("data_abertura")
        .eq("id", profile.id)
        .single();

      if (fullProfile?.data_abertura) {
        const abertura = new Date(fullProfile.data_abertura);
        const monthsOld = (Date.now() - abertura.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsOld < 3) {
          factors.push({
            code: "NEW_CNPJ",
            label: "CNPJ aberto há menos de 3 meses",
            points: 15,
          });
        }
      }
    }

    // 8. Non-Brazil country
    if (geo?.country && !geo.country.toLowerCase().includes("brazil") && !geo.country.toLowerCase().includes("brasil")) {
      factors.push({
        code: "FOREIGN_IP",
        label: `Acesso de ${geo.country}`,
        points: 10,
      });
    }

    // Calculate total score
    const totalScore = Math.min(factors.reduce((sum, f) => sum + f.points, 0), 100);

    // Determine risk level
    let riskLevel: string;
    let status: string;
    if (totalScore <= 30) {
      riskLevel = "low";
      status = "auto_approved";
    } else if (totalScore <= 60) {
      riskLevel = "medium";
      status = "manual_review";
    } else {
      riskLevel = "high";
      status = "blocked";
    }

    // Save risk assessment
    const { data: assessment } = await adminClient
      .from("risk_assessments")
      .insert({
        profile_id: profile.id,
        user_id: user.id,
        score: totalScore,
        risk_level: riskLevel,
        factors: factors,
        status: status,
      })
      .select()
      .single();

    // If blocked, deactivate profile
    if (status === "blocked") {
      await adminClient
        .from("profiles")
        .update({ is_active: false })
        .eq("id", profile.id);
    }

    return new Response(
      JSON.stringify({
        score: totalScore,
        risk_level: riskLevel,
        status,
        factors,
        assessment_id: assessment?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Risk score error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
