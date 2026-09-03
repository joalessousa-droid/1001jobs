import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RadarStage } from "@/hooks/useProfessionalRadar";

const LOCAL_KEY = "radar_history_events_v1";

export interface RadarHistoryEvent {
  id: string;
  request_id: string;
  at: string;
  stage: RadarStage | "quote" | "declined" | "cancelled";
  label: string;
  provider_name?: string | null;
  price?: number | null;
  sandbox?: boolean;
}

export interface RadarHistoryRequest {
  id: string;
  created_at: string;
  description: string | null;
  status: string | null;
  urgency: string | null;
  category_name?: string | null;
  offers_total: number;
  quotes_total: number;
  accepted_price: number | null;
  accepted_provider: string | null;
  sandbox?: boolean;
  events: RadarHistoryEvent[];
}

const readLocal = (): RadarHistoryEvent[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
  } catch {
    return [];
  }
};

const writeLocal = (events: RadarHistoryEvent[]) => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(events.slice(-300)));
};

/** Registra uma etapa concluída no histórico local (inclui modo de teste) */
export const logRadarEvent = (e: Omit<RadarHistoryEvent, "id" | "at">) => {
  const events = readLocal();
  events.push({ ...e, id: crypto.randomUUID(), at: new Date().toISOString() });
  writeLocal(events);
  window.dispatchEvent(new CustomEvent("radar-history-updated"));
};

export const clearRadarLocalHistory = () => {
  localStorage.removeItem(LOCAL_KEY);
  window.dispatchEvent(new CustomEvent("radar-history-updated"));
};

/** Histórico de solicitações do Radar: contratações, ofertas aceitas e etapas */
export const useRadarHistory = (profileId?: string | null) => {
  const [requests, setRequests] = useState<RadarHistoryRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const local = readLocal();
    if (!profileId) {
      setRequests(buildSandboxOnly(local));
      return;
    }
    setLoading(true);
    const { data: reqs } = await supabase
      .from("service_requests")
      .select("id, created_at, description, status, urgency, category_id")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30);

    const ids = (reqs ?? []).map((r: any) => r.id);
    const [{ data: offers }, { data: cats }] = await Promise.all([
      ids.length
        ? supabase
            .from("service_offers")
            .select("id, service_request_id, provider_id, status, metadata, offered_at")
            .in("service_request_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("service_categories").select("id, name"),
    ]);

    const catName = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
    const providerIds = [...new Set((offers ?? []).map((o: any) => o.provider_id))];
    const { data: profs } = providerIds.length
      ? await supabase.from("public_profiles").select("id, display_name").in("id", providerIds)
      : { data: [] as any[] };
    const nameOf = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));

    const mapped: RadarHistoryRequest[] = (reqs ?? []).map((r: any) => {
      const mine = (offers ?? []).filter((o: any) => o.service_request_id === r.id);
      const accepted = mine.find((o: any) => o.status === "accepted");
      const events: RadarHistoryEvent[] = mine
        .filter((o: any) => o.metadata?.quoted_price != null || o.status !== "pending")
        .map((o: any) => ({
          id: o.id,
          request_id: r.id,
          at: o.offered_at,
          stage:
            o.status === "accepted"
              ? ("accepted" as const)
              : o.status === "declined"
                ? ("declined" as const)
                : ("quote" as const),
          label:
            o.status === "accepted"
              ? "Oferta aceita"
              : o.status === "declined"
                ? "Profissional recusou"
                : "Preço recebido",
          provider_name: nameOf.get(o.provider_id) ?? "Profissional",
          price: o.metadata?.quoted_price != null ? Number(o.metadata.quoted_price) : null,
        }))
        .concat(local.filter((e) => e.request_id === r.id))
        .sort((a, b) => +new Date(a.at) - +new Date(b.at));

      return {
        id: r.id,
        created_at: r.created_at,
        description: r.description,
        status: r.status,
        urgency: r.urgency,
        category_name: catName.get(r.category_id) ?? null,
        offers_total: mine.length,
        quotes_total: mine.filter((o: any) => o.metadata?.quoted_price != null).length,
        accepted_price:
          accepted?.metadata?.quoted_price != null ? Number(accepted.metadata.quoted_price) : null,
        accepted_provider: accepted ? (nameOf.get(accepted.provider_id) ?? "Profissional") : null,
        events,
      };
    });

    setRequests([...buildSandboxOnly(local), ...mapped]);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener("radar-history-updated", onUpdate);
    return () => window.removeEventListener("radar-history-updated", onUpdate);
  }, [load]);

  return { requests, loading, reload: load };
};

/** Agrupa eventos locais de sessões de teste (sem solicitação real) */
const buildSandboxOnly = (local: RadarHistoryEvent[]): RadarHistoryRequest[] => {
  const groups = new Map<string, RadarHistoryEvent[]>();
  local
    .filter((e) => e.sandbox)
    .forEach((e) => groups.set(e.request_id, [...(groups.get(e.request_id) ?? []), e]));
  return [...groups.entries()]
    .map(([id, events]) => {
      const sorted = events.sort((a, b) => +new Date(a.at) - +new Date(b.at));
      const acc = sorted.find((e) => e.stage === "accepted");
      return {
        id,
        created_at: sorted[0].at,
        description: "Sessão do modo de teste",
        status: sorted.some((e) => e.stage === "arrived") ? "completed" : "test",
        urgency: null,
        category_name: null,
        offers_total: sorted.filter((e) => e.stage === "quote").length,
        quotes_total: sorted.filter((e) => e.stage === "quote").length,
        accepted_price: acc?.price ?? null,
        accepted_provider: acc?.provider_name ?? null,
        sandbox: true,
        events: sorted,
      } as RadarHistoryRequest;
    })
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
};

export default useRadarHistory;
