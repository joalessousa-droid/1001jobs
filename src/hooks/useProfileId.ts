import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Retorna o profiles.id do usuário autenticado. */
export function useProfileId() {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setProfileId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      setProfileId(data?.id ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  return { profileId, loading };
}
