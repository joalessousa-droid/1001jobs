import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, MapPin, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface DemandCell {
  cell_lat: number;
  cell_lng: number;
  category_name: string | null;
  requests: number;
  distance_km: number;
}

/** #27 — Notificação inteligente: alerta de alta demanda perto do profissional. */
const DemandAlertCard = () => {
  const [loading, setLoading] = useState(false);
  const [top, setTop] = useState<DemandCell | null>(null);
  const [checked, setChecked] = useState(false);

  const check = () => {
    setLoading(true);
    const run = async (lat: number, lng: number) => {
      const { data, error } = await supabase.rpc("get_demand_heatmap", {
        _lat: lat,
        _lng: lng,
        _radius_km: 10,
        _hours: 1,
      });
      if (error) throw error;
      const rows = (data ?? []) as DemandCell[];
      const hottest = rows.sort((a, b) => b.requests - a.requests)[0] ?? null;
      setTop(hottest && hottest.requests >= 2 ? hottest : null);
      setChecked(true);
    };
    if (!navigator.geolocation) {
      toast.info("Ative a localização para ver demandas próximas.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void run(pos.coords.latitude, pos.coords.longitude)
          .catch(() => toast.error("Não foi possível consultar a demanda agora."))
          .finally(() => setLoading(false));
      },
      () => {
        toast.info("Permita o acesso à localização para ver demandas próximas.");
        setLoading(false);
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checked && !top) return null;

  return (
    <Card
      className="p-5 border-amber-500/40 bg-amber-500/5 space-y-3"
      data-testid="demand-alert-card"
    >
      <h3 className="font-display font-semibold flex items-center gap-2">
        <Flame className="w-5 h-5 text-amber-500" />
        Demanda 1001
      </h3>
      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Verificando demanda na sua região…
        </p>
      ) : top ? (
        <>
          <p className="text-sm">
            Alta demanda a {top.distance_km.toFixed(1)} km:{" "}
            <strong>
              {top.requests} solicitações
              {top.category_name ? ` de ${top.category_name}` : ""} na última hora
            </strong>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-2" data-testid="demand-open-map">
              <Link to="/demanda">
                <MapPin className="w-4 h-4" /> Ver mapa de demanda
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" data-testid="demand-stay-available">
              <Link to="/dashboard?tab=services">Ficar disponível</Link>
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
};

export default DemandAlertCard;
