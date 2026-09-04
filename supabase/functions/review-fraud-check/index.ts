import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCaller } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Review Anti-Fraud Engine
 * Detects: same IP, same device, 5-star spam, new account spam, suspicious patterns
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const guard = await requireCaller(req, corsHeaders, { requireStaff: true });
  if (!guard.ok) return guard.response;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { review_id } = await req.json();
    if (!review_id) {
      return new Response(JSON.stringify({ error: "review_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the review
    const { data: review } = await admin
      .from("reviews")
      .select("id, reviewer_id, reviewed_id, rating, created_at")
      .eq("id", review_id)
      .single();

    if (!review) {
      return new Response(JSON.stringify({ error: "Review not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fraudLogs: { fraud_type: string; details: Record<string, any>; score: number }[] = [];

    // 1. Check same device/IP: get reviewer's fingerprints
    const { data: reviewerProfile } = await admin
      .from("profiles")
      .select("user_id, created_at")
      .eq("id", review.reviewer_id)
      .single();

    const { data: reviewedProfile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("id", review.reviewed_id)
      .single();

    if (reviewerProfile && reviewedProfile) {
      // Same IP check
      const { data: reviewerFps } = await admin
        .from("device_fingerprints")
        .select("ip_address, fingerprint_hash")
        .eq("user_id", reviewerProfile.user_id)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: reviewedFps } = await admin
        .from("device_fingerprints")
        .select("ip_address, fingerprint_hash")
        .eq("user_id", reviewedProfile.user_id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (reviewerFps && reviewedFps) {
        const reviewerIPs = new Set(reviewerFps.map((f) => f.ip_address).filter(Boolean));
        const reviewedIPs = new Set(reviewedFps.map((f) => f.ip_address).filter(Boolean));
        const sharedIPs = [...reviewerIPs].filter((ip) => reviewedIPs.has(ip));

        if (sharedIPs.length > 0) {
          fraudLogs.push({
            fraud_type: "SAME_IP",
            details: { shared_ips: sharedIPs },
            score: 30,
          });
        }

        // Same device check
        const reviewerHashes = new Set(reviewerFps.map((f) => f.fingerprint_hash));
        const reviewedHashes = new Set(reviewedFps.map((f) => f.fingerprint_hash));
        const sharedDevices = [...reviewerHashes].filter((h) => reviewedHashes.has(h));

        if (sharedDevices.length > 0) {
          fraudLogs.push({
            fraud_type: "SAME_DEVICE",
            details: { shared_hashes: sharedDevices.length },
            score: 40,
          });
        }
      }
    }

    // 2. Sequential 5-star reviews check
    const { data: recentReviews } = await admin
      .from("reviews")
      .select("rating, created_at")
      .eq("reviewer_id", review.reviewer_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (recentReviews) {
      const consecutive5Stars = recentReviews.filter((r) => r.rating === 5).length;
      if (consecutive5Stars >= 5 && recentReviews.length >= 5) {
        fraudLogs.push({
          fraud_type: "CONSECUTIVE_5_STARS",
          details: { count: consecutive5Stars, total: recentReviews.length },
          score: 20,
        });
      }
    }

    // 3. New account spam check
    if (reviewerProfile) {
      const accountAge = (Date.now() - new Date(reviewerProfile.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (accountAge < 7) {
        const { count } = await admin
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("reviewer_id", review.reviewer_id);

        if ((count || 0) > 3) {
          fraudLogs.push({
            fraud_type: "NEW_ACCOUNT_SPAM",
            details: { account_age_days: Math.round(accountAge), review_count: count },
            score: 25,
          });
        }
      }
    }

    // 4. Repeated reviews to same user
    const { count: repeatCount } = await admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", review.reviewer_id)
      .eq("reviewed_id", review.reviewed_id);

    if ((repeatCount || 0) > 1) {
      fraudLogs.push({
        fraud_type: "REPEATED_REVIEWER",
        details: { review_count_to_same_user: repeatCount },
        score: 35,
      });
    }

    // 5. Timing pattern: multiple reviews in short period
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", review.reviewer_id)
      .gte("created_at", oneHourAgo);

    if ((recentCount || 0) > 3) {
      fraudLogs.push({
        fraud_type: "BURST_REVIEWS",
        details: { reviews_in_last_hour: recentCount },
        score: 20,
      });
    }

    // Calculate total fraud score
    const totalFraudScore = Math.min(fraudLogs.reduce((sum, f) => sum + f.score, 0), 100);
    const isShadow = totalFraudScore >= 50;
    const flagForMediation = totalFraudScore >= 30;

    // Save fraud logs
    for (const log of fraudLogs) {
      await admin.from("review_fraud_logs").insert({
        review_id,
        reviewer_id: review.reviewer_id,
        fraud_type: log.fraud_type,
        details: log.details,
        score: log.score,
        flagged_for_mediation: flagForMediation,
      });
    }

    // Update review fraud score and shadow status
    await admin.from("reviews").update({
      fraud_score: totalFraudScore,
      is_shadow: isShadow,
    }).eq("id", review_id);

    return new Response(JSON.stringify({
      fraud_score: totalFraudScore,
      is_shadow: isShadow,
      flagged_for_mediation: flagForMediation,
      factors: fraudLogs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Review fraud check error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
