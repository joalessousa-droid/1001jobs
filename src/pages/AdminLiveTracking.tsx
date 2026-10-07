// Admin: localização ao vivo de todos os profissionais (mapa + gráfico).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw } from "lucide-react";

type Loc = {
  provider_id: string; provider_name: string | null; city: string | null; latitude: number; longitude: number;
  accuracy: number | null; speed: number | null; is_sharing: boolean; is_synthetic: boolean; updated_at: string;
};

const ageMin = (ts: string) => (Date.now() - new Date(ts).getTime()) / 60000;
const bucket = (ts: string) => {
  const m = ageMin(ts);
  if (m <= 5) return "Ao vivo (≤5 min)";
  if (m <= 60) return "Última hora";
  if (m <= 1440) return "Últimas 24 h";
  return "Mais antigo";
};
const BUCKETS = ["Ao vivo (≤5 min)", "Última hora", "Últimas 24 h", "Mais antigo"];

export default function AdminLiveTracking() {
  const [rows, setRows] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthetic, setSynthetic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_live_provider_locations" as never, { _include_synthetic: synthetic } as never);
    if (error) setError("Não foi possível carregar as localizações.");
    else { setError(null); setRows(((data as unknown) as Loc[]) ?? []); setLastSync(new Date()); }
    setLoading(false);
  }, [synthetic]);

  useEffect(() => { fitted.current = false; void load(); }, [load]);

  // Atualização ao vivo: Realtime de provider_locations + recarga a cada 20 s como garantia.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => { if (t) clearTimeout(t); t = setTimeout(() => void load(), 1500); };
    const ch = supabase.channel("admin-live-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_locations" }, debounced)
      .subscribe();
    const iv = setInterval(() => void load(), 20000);
    return () => { if (t) clearTimeout(t); clearInterval(iv); supabase.removeChannel(ch); };
  }, [load]);

  useEffect(() => {
    if (!ref.current || map.current) return;
    map.current = L.map(ref.current).setView([-23.55, -46.63], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, [loading]);

  useEffect(() => {
    const m = map.current; const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    rows.forEach((r) => {
      const live = ageMin(r.updated_at) <= 5;
      L.circleMarker([r.latitude, r.longitude], {
        radius: live ? 8 : 5, weight: 2,
        color: live ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
        fillOpacity: live ? 0.8 : 0.4,
      }).bindPopup(
        `<b>${r.provider_name ?? "Profissional"}</b>${r.is_synthetic ? " (demo)" : ""}<br/>${r.city ?? ""}<br/>` +
        `Atualizado: ${new Date(r.updated_at).toLocaleString("pt-BR")}` +
        (r.speed != null ? `<br/>Velocidade: ${(r.speed * 3.6).toFixed(0)} km/h` : ""),
      ).addTo(g);
    });
    if (rows.length && !fitted.current) {
      m.fitBounds(L.latLngBounds(rows.map((r) => [r.latitude, r.longitude] as [number, number])).pad(0.2));
      fitted.current = true;
    }
  }, [rows]);

  const chart = useMemo(() => BUCKETS.map((b) => ({ faixa: b, total: rows.filter((r) => bucket(r.updated_at) === b).length })), [rows]);
  const liveCount = chart[0].total;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-6 space-y-6" data-testid="admin-live-tracking">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Rastreamento ao vivo</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} profissionais com localização · {liveCount} ao vivo
              {lastSync && ` · atualizado às ${lastSync.toLocaleTimeString("pt-BR")}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="syn" checked={synthetic} onCheckedChange={setSynthetic} />
              <Label htmlFor="syn">Incluir demonstração</Label>
            </div>
            <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
          <>
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card><CardHeader><CardTitle className="text-base">Mapa</CardTitle></CardHeader>
                <CardContent><div ref={ref} data-testid="admin-live-map" className="h-[480px] w-full rounded-lg border border-border" /></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Última atualização</CardTitle></CardHeader>
                <CardContent className="h-[480px]" data-testid="admin-live-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="faixa" width={110} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="total" name="Profissionais" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle className="text-base">Profissionais</CardTitle></CardHeader>
              <CardContent className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-left"><tr><th className="py-2">Profissional</th><th>Cidade</th><th>Compartilhando</th><th>Velocidade</th><th>Atualizado</th></tr></thead>
                  <tbody>{rows.slice(0, 300).map((r) => (
                    <tr key={r.provider_id} className="border-t border-border cursor-pointer hover:bg-accent"
                      onClick={() => map.current?.setView([r.latitude, r.longitude], 16)}>
                      <td className="py-2 font-medium">{r.provider_name ?? "—"}{r.is_synthetic && <span className="text-muted-foreground"> (demo)</span>}</td>
                      <td>{r.city ?? "—"}</td><td>{r.is_sharing ? "Sim" : "Não"}</td>
                      <td>{r.speed != null ? `${(r.speed * 3.6).toFixed(0)} km/h` : "—"}</td>
                      <td>{new Date(r.updated_at).toLocaleString("pt-BR")}</td>
                    </tr>))}
                    {!rows.length && <tr><td colSpan={5} className="py-4 text-muted-foreground">Nenhuma localização registrada.</td></tr>}
                  </tbody>
                </table>
              </CardContent></Card>
          </>
        )}
      </main>
    </div>
  );
}
