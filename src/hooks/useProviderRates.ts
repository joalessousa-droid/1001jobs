import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Preços reais praticados pelos profissionais (tabela provider_services).
 * Usado no radar para exibir o valor de referência de profissionais reais,
 * além dos orçamentos enviados em tempo real.
 */
export function useProviderRates(providerIds: string[], categoryId?: string | null) {
  const [rates, setRates] = useState<Record<string, number>>({});
  const key = [...providerIds].sort().join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setRates({});
      return;
    }
    let cancelled = false;
    void (async () => {
      let query = supabase
        .from("provider_services")
        .select("provider_id, category_id, hourly_rate")
        .in("provider_id", ids.slice(0, 200));
      if (categoryId) query = query.eq("category_id", categoryId);
      const { data } = await query;
      if (cancelled) return;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const v = Number(r.hourly_rate);
        if (!Number.isFinite(v) || v <= 0) return;
        map[r.provider_id] = map[r.provider_id] ? Math.min(map[r.provider_id], v) : v;
      });
      setRates(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, categoryId]);

  return rates;
}
