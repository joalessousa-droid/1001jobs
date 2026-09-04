import { useCallback, useEffect, useState } from "react";
import { getMarketPrice, type MarketPrice, type MarketPriceQuery } from "@/lib/ai1001Learning";

/** 7/43/44 — busca o preço de mercado 1001 para a categoria/região informada. */
export function useMarketPrice(query: MarketPriceQuery | null) {
  const [data, setData] = useState<MarketPrice | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!query?.category) return;
    setLoading(true);
    try {
      setData(await getMarketPrice(query));
    } catch {
      setData({ available: false, level_used: "none", confidence: "insuficiente" });
    } finally {
      setLoading(false);
    }
  }, [query?.category, query?.state, query?.city, query?.neighborhood, query?.urgency, query?.complexity]);

  useEffect(() => {
    void load();
  }, [load]);

  return { marketPrice: data, loading, reload: load };
}
