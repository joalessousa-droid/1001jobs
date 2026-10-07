// Aviso ao vivo para o cliente: "Seu profissional chegou ao local" — sem recarregar a página.
// Reutiliza o Realtime já publicado de service_tracking (mesmas regras de acesso).
import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { playArrivalSound, isRadarSoundEnabled } from "@/lib/radarSounds";

interface Props { serviceId: string; providerName?: string | null }

const ArrivalLiveAlert = ({ serviceId, providerName }: Props) => {
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const initial = useRef(true);

  useEffect(() => {
    let active = true;
    supabase.from("service_tracking").select("arrived_at").eq("service_id", serviceId).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setArrivedAt((data as { arrived_at: string | null } | null)?.arrived_at ?? null);
        initial.current = false;
      });
    const ch = supabase
      .channel(`arrival-${serviceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "service_tracking", filter: `service_id=eq.${serviceId}` },
        (payload) => {
          const row = payload.new as { arrived_at?: string | null };
          if (row.arrived_at) {
            setArrivedAt((prev) => {
              if (!prev && !initial.current) {
                setDismissed(false);
                if (isRadarSoundEnabled()) playArrivalSound();
                toast.success(`${providerName?.split(" ")[0] || "Seu profissional"} chegou ao local`, {
                  description: "Vá até a porta para recebê-lo.",
                });
              }
              return row.arrived_at ?? prev;
            });
          }
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [serviceId, providerName]);

  if (!arrivedAt || dismissed) return null;
  return (
    <div role="alert" data-testid="arrival-live-alert"
      className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-semibold">Seu profissional chegou ao local</p>
        <p className="text-sm text-muted-foreground">
          {providerName ? `${providerName} está no endereço do serviço.` : "O profissional está no endereço do serviço."}{" "}
          Chegada às {new Date(arrivedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
        </p>
      </div>
      <button aria-label="Fechar aviso" onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ArrivalLiveAlert;
