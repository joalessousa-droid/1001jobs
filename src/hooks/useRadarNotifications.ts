import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RADAR_STAGE_LABEL, type RadarQuote, type RadarStage } from "@/hooks/useProfessionalRadar";

interface Options {
  active: boolean;
  stage: RadarStage;
  quotes: RadarQuote[];
  serviceRequestId?: string | null;
  nameOf?: (providerId: string) => string;
  onEvent?: (label: string, extra?: { provider_name?: string; price?: number | null }) => void;
}

const STAGE_TOAST: Partial<Record<RadarStage, string>> = {
  found: "Profissionais encontrados perto de você",
  dispatching: "Enviando sua solicitação aos profissionais…",
  offer_sent: "Solicitação enviada — aguardando preços",
  accepted: "Profissional aceitou o serviço!",
  enroute: "O profissional está a caminho",
  arrived: "O profissional chegou ao local",
};

/** Alertas em tempo real das etapas do despacho e das respostas dos profissionais */
export const useRadarNotifications = ({
  active,
  stage,
  quotes,
  serviceRequestId = null,
  nameOf,
  onEvent,
}: Options) => {
  const prevStage = useRef<RadarStage>("idle");
  const seenQuotes = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!active) {
      prevStage.current = "idle";
      seenQuotes.current = new Set();
      return;
    }
    if (stage === prevStage.current) return;
    prevStage.current = stage;
    const msg = STAGE_TOAST[stage];
    if (!msg) return;
    if (stage === "arrived") toast.success(msg, { duration: 8000 });
    else if (stage === "accepted") toast.success(msg);
    else toast.message(msg);
    onEvent?.(RADAR_STAGE_LABEL[stage]);
  }, [active, stage, onEvent]);

  useEffect(() => {
    if (!active) return;
    quotes.forEach((q) => {
      if (seenQuotes.current.has(q.offer_id)) return;
      seenQuotes.current.add(q.offer_id);
      const name = nameOf?.(q.provider_id) ?? "Profissional";
      toast.success(
        `${name} enviou um preço: ${q.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
      );
      onEvent?.("Preço recebido", { provider_name: name, price: q.price });
    });
  }, [active, quotes, nameOf, onEvent]);

  /* Recusas em tempo real */
  useEffect(() => {
    if (!active || !serviceRequestId) return;
    const channel = supabase
      .channel(`radar-notify-${serviceRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "service_offers",
          filter: `service_request_id=eq.${serviceRequestId}`,
        },
        (payload) => {
          const row: any = payload.new;
          const name = nameOf?.(row?.provider_id) ?? "Profissional";
          if (row?.status === "declined") {
            toast.warning(`${name} recusou a solicitação`);
            onEvent?.("Profissional recusou", { provider_name: name });
          }
          if (row?.status === "expired") {
            toast.message(`A oferta para ${name} expirou`);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, serviceRequestId, nameOf, onEvent]);
};

export default useRadarNotifications;
