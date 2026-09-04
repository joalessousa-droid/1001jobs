import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCaller } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Weighted Reputation Algorithm
 * 
 * Formula: R = clamp(1, 5, W_avg - D_penalty)
 * 
 * W_avg = Σ(w_i * r_i) / Σ(w_i)
 * where w_i = recency_weight * volume_weight
 * 
 * recency_weight = e^(-λ * days_old)  (λ = 0.005, half-life ~139 days)
 * volume_weight = 1 + log2(1 + volume_bucket)
 * 
 * D_penalty = dispute_rate * 0.5 (max 0.5 penalty)
 */
function computeWeightedScore(
  reviews: { rating: number; created_at: string; reviewer_review_count: number }[],
  disputeRate: number
): { score: number; breakdown: Record<string, number> } {
  if (reviews.length === 0) return { score: 0, breakdown: {} };

  const now = Date.now();
  const LAMBDA = 0.005;
  let weightedSum = 0;
  let totalWeight = 0;

  for (const r of reviews) {
    const daysOld = (now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.exp(-LAMBDA * daysOld);
    const volumeBucket = Math.min(r.reviewer_review_count, 50);
    const volumeWeight = 1 + Math.log2(1 + volumeBucket);
    const w = recencyWeight * volumeWeight;
    weightedSum += w * r.rating;
    totalWeight += w;
  }

  const wAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const dPenalty = Math.min(disputeRate * 0.5, 0.5);
  const finalScore = Math.max(1, Math.min(5, wAvg - dPenalty));

  return {
    score: Math.round(finalScore * 100) / 100,
    breakdown: {
      weighted_average: Math.round(wAvg * 100) / 100,
      dispute_penalty: Math.round(dPenalty * 100) / 100,
      total_weight: Math.round(totalWeight * 100) / 100,
      review_count: reviews.length,
    },
  };
}

function computeBadges(totalReviews: number, score: number, disputeRate: number): string[] {
  const badges: string[] = [];
  if (totalReviews >= 100) badges.push("veterano");
  else if (totalReviews >= 50) badges.push("experiente");
  else if (totalReviews >= 10) badges.push("ativo");
  if (score >= 4.8 && totalReviews >= 10) badges.push("top_rated");
  if (score >= 4.5 && totalReviews >= 5) badges.push("recomendado");
  if (disputeRate === 0 && totalReviews >= 5) badges.push("zero_disputas");
  if (disputeRate <= 0.02 && totalReviews >= 20) badges.push("confiavel");
  return badges;
}

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

    const { profile_id } = await req.json();
    if (!profile_id) {
      return new Response(JSON.stringify({ error: "profile_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all published, non-shadow reviews for this profile
    const { data: reviews } = await admin
      .from("reviews")
      .select("id, rating, created_at, reviewer_id, is_published, is_shadow, is_contested")
      .eq("reviewed_id", profile_id)
      .eq("is_published", true)
      .eq("is_shadow", false);

    // Get reviewer review counts for volume weighting
    const enriched = [];
    const reviewerCounts: Record<string, number> = {};

    for (const r of reviews || []) {
      if (!reviewerCounts[r.reviewer_id]) {
        const { count } = await admin
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("reviewer_id", r.reviewer_id);
        reviewerCounts[r.reviewer_id] = count || 0;
      }
      enriched.push({
        rating: r.rating,
        created_at: r.created_at,
        reviewer_review_count: reviewerCounts[r.reviewer_id],
      });
    }

    // Dispute stats
    const { count: disputeCount } = await admin
      .from("review_disputes")
      .select("id", { count: "exact", head: true })
      .in("review_id", (reviews || []).map((r) => r.id));

    const totalReviews = enriched.length;
    const totalDisputes = disputeCount || 0;
    const disputeRate = totalReviews > 0 ? totalDisputes / totalReviews : 0;

    const { score, breakdown } = computeWeightedScore(enriched, disputeRate);
    const badges = computeBadges(totalReviews, score, disputeRate);
    const lastReview = enriched.length > 0
      ? enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : null;

    // Upsert reputation score
    await admin.from("reputation_scores").upsert({
      profile_id,
      weighted_score: score,
      total_reviews: totalReviews,
      total_disputes: totalDisputes,
      dispute_rate: Math.round(disputeRate * 10000) / 10000,
      last_review_at: lastReview,
      badges,
      score_breakdown: breakdown,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });

    return new Response(JSON.stringify({
      score, total_reviews: totalReviews, total_disputes: totalDisputes,
      dispute_rate: disputeRate, badges, breakdown,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Reputation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
