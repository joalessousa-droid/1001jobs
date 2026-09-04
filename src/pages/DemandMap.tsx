import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Loader2, MapPin, RefreshCw } from "lucide-react";

interface DemandCell {
  cell_lat: number;
  cell_lng: number;
  category_id: string | null;
  category_name: string | null;
  requests: number;
  distance_km: number;
}

const level = (n: number) =>
  n >= 8 ? { label: "Alta demanda", color: "bg-red-500" } : n >= 4 ? { label: "Média demanda", color: "bg-orange-500" } : { label: "Baixa demanda", color: "bg-emerald-500" };

/** DEMANDA 1001 — regiões com maior procura para o profissional se posicionar. */
const DemandMap = () => {
  const [cells, setCells] = useState<DemandCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [hours, setHours] = useState(24);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setCoords([-23.5505, -46.6333]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords([p.coords.latitude, p.coords.longitude]),
      () => setCoords([-23.5505, -46.6333]),
      { timeout: 8000 },
    );
  }, []);

  const load = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("get_demand_heatmap", {
      _lat: coords[0],
      _lng: coords[1],
      _radius_km: 25,
      _hours: hours,
    });
    if (err) setError("Não foi possível carregar a demanda agora.");
    setCells((data ?? []) as DemandCell[]);
    setLoading(false);
  }, [coords, hours]);

  useEffect(() => {
    void load();
  }, [load]);

  const top = useMemo(() => cells[0], [cells]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-20 md:pt-24 pb-10 max-w-3xl">
        <header className="mb-6">
          <Badge variant="outline" className="gap-1 mb-3 border-primary/30 text-primary">
            <Flame className="w-3.5 h-3.5" /> Demanda 1001
          </Badge>
          <h1 className="text-3xl font-bold font-display">Mapa de demanda</h1>
          <p className="text-muted-foreground mt-1">
            Regiões com mais solicitações perto de você nas últimas {hours} horas.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[3, 12, 24, 72].map((h) => (
            <Button
              key={h}
              size="sm"
              variant={hours === h ? "default" : "outline"}
              onClick={() => setHours(h)}
            >
              {h}h
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="gap-2 ml-auto" onClick={load}>
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>

        {top && (
          <Card className="p-4 mb-4 border-primary/30" data-testid="demand-highlight">
            <p className="font-medium">
              🔥 {level(top.requests).label} a {top.distance_km.toFixed(1)} km
            </p>
            <p className="text-sm text-muted-foreground">
              {top.requests} solicitações{top.category_name ? ` de ${top.category_name}` : ""} nas últimas {hours} horas.
            </p>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando demanda...
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && cells.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma solicitação registrada nessa janela de tempo por perto.
          </p>
        )}

        <div className="space-y-2" data-testid="demand-list">
          {cells.map((c, i) => {
            const lv = level(c.requests);
            return (
              <Card key={`${c.cell_lat}-${c.cell_lng}-${c.category_id}-${i}`} className="p-3 flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${lv.color}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.category_name ?? "Serviços gerais"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {c.distance_km.toFixed(1)} km · {lv.label}
                  </p>
                </div>
                <Badge variant="secondary">{c.requests} pedidos</Badge>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default DemandMap;
