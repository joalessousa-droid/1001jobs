import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfileId } from "@/hooks/useProfileId";

export interface FavoriteProvider {
  id: string;
  provider_id: string;
  created_at: string;
  provider?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    provider_tier: string | null;
    city: string | null;
  } | null;
}

export function useFavoriteProviders() {
  const { profileId } = useProfileId();
  const [favorites, setFavorites] = useState<FavoriteProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profileId) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("favorite_providers")
      .select("id, provider_id, created_at")
      .eq("client_id", profileId)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as FavoriteProvider[];
    if (rows.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, provider_tier, city")
        .in("id", rows.map((r) => r.provider_id));
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => {
        r.provider = (map.get(r.provider_id) as FavoriteProvider["provider"]) ?? null;
      });
    }
    setFavorites(rows);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isFavorite = useCallback(
    (providerId: string) => favorites.some((f) => f.provider_id === providerId),
    [favorites],
  );

  const toggleFavorite = useCallback(
    async (providerId: string) => {
      if (!profileId) throw new Error("Entre na sua conta para favoritar.");
      const existing = favorites.find((f) => f.provider_id === providerId);
      if (existing) {
        await supabase.from("favorite_providers").delete().eq("id", existing.id);
        setFavorites((f) => f.filter((x) => x.id !== existing.id));
        return false;
      }
      const { data, error } = await supabase
        .from("favorite_providers")
        .insert({ client_id: profileId, provider_id: providerId })
        .select("id, provider_id, created_at")
        .single();
      if (error) throw error;
      setFavorites((f) => [data as FavoriteProvider, ...f]);
      return true;
    },
    [favorites, profileId],
  );

  return { favorites, loading, isFavorite, toggleFavorite, reload: load, canFavorite: !!profileId };
}
