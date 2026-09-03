import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProviderReputation {
  provider_id: string;
  rating: number | null;
  total_reviews: number;
  total_services: number;
  verified: boolean;
  badges: string[];
}

/**
 * Resumo de reputação (avaliação, serviços avaliados e verificação)
 * usado nos cards de oferta do Radar.
 */
export const useProviderReputation = (providerIds: string[]) => {
  const [map, setMap] = useState<Record<string, ProviderReputation>>({});
  const key = [...new Set(providerIds.filter((id) => id && !id.startsWith("sandbox")))]
    .sort()
    .join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const [{ data: reps }, { data: profs }] = await Promise.all([
        supabase
          .from("reputation_scores")
          .select("profile_id, weighted_score, total_reviews, badges")
          .in("profile_id", ids),
        supabase.from("public_profiles").select("id, verification_status").in("id", ids),
      ]);
      if (cancelled) return;
      const verified = new Map(
        (profs ?? []).map((p: any) => [p.id, p.verification_status === "verified"])
      );
      const next: Record<string, ProviderReputation> = {};
      ids.forEach((id) => {
        const r: any = (reps ?? []).find((x: any) => x.profile_id === id);
        next[id] = {
          provider_id: id,
          rating: r?.weighted_score != null ? Number(r.weighted_score) : null,
          total_reviews: Number(r?.total_reviews ?? 0),
          total_services: Number(r?.total_reviews ?? 0),
          verified: !!verified.get(id),
          badges: Array.isArray(r?.badges) ? (r.badges as string[]) : [],
        };
      });
      setMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
};

export default useProviderReputation;
