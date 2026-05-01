import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ServiceStatus = Database["public"]["Enums"]["service_status"];
export type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  client?: { display_name: string; avatar_url: string | null } | null;
  provider?: { display_name: string; avatar_url: string | null } | null;
  category?: { name: string } | null;
};

const SELECT = `
  *,
  client:profiles!services_client_id_fkey(display_name, avatar_url),
  provider:profiles!services_provider_id_fkey(display_name, avatar_url),
  category:service_categories(name)
`;

// Fallback select sem foreign-key hints (caso joins nomeados não funcionem)
const SELECT_SIMPLE = "*";

export function useServices(profileId: string | null, role: "client" | "provider" | "all" = "all") {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    let query = supabase.from("services").select(SELECT_SIMPLE);
    if (role === "client") query = query.eq("client_id", profileId);
    else if (role === "provider") query = query.eq("provider_id", profileId);
    else query = query.or(`client_id.eq.${profileId},provider_id.eq.${profileId}`);
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (!error && data) setServices(data as unknown as ServiceRow[]);
    setLoading(false);
  }, [profileId, role]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`services-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => fetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, fetch]);

  return { services, loading, refetch: fetch };
}

export async function transitionStatus(
  serviceId: string,
  newStatus: ServiceStatus,
  reason?: string
) {
  const { data, error } = await supabase.rpc("transition_service_status", {
    _service_id: serviceId,
    _new_status: newStatus,
    _reason: reason ?? null,
  });
  if (error) throw error;
  return data;
}
