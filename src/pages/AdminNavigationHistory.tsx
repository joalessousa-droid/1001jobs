// Admin: histórico de navegações, chegadas e ações por profissional (Modo Navegação da Tarefa)
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";

type NavEvent = {
  id: string; service_id: string; service_title: string | null; provider_id: string | null;
  provider_name: string | null; event_type: string; latitude: number | null; longitude: number | null;
  accuracy: number | null; source: string | null; metadata: Record<string, unknown> | null; created_at: string;
};

const LABEL: Record<string, string> = {
  navigation_started: "Navegação iniciada",
  navigation_provider: "App escolhido",
  en_route: "A caminho",
  arrival_detected: "Aproximação (GPS)",
  arrival_confirmed: "Chegada (GPS)",
  provider_manual_arrival: "Chegada (botão)",
  arrival_notification_sent: "Aviso ao cliente",
};
const COLOR: Record<string, string> = {
  navigation_started: "hsl(var(--primary))",
  en_route: "hsl(var(--accent-foreground))",
  arrival_detected: "hsl(var(--muted-foreground))",
  arrival_confirmed: "hsl(var(--primary))",
  provider_manual_arrival: "hsl(var(--destructive))",
};

const EventsMap = ({ events }: { events: NavEvent[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    mapRef.current = L.map(ref.current).setView([-23.55, -46.63], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(mapRef.current);
    layerRef.current = L.layerGroup().addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    const layer = layerRef.current; const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const pts = events.filter((e) => e.latitude != null && e.longitude != null);
    pts.forEach((e) => {
      L.circleMarker([e.latitude!, e.longitude!], {
        radius: e.event_type.includes("arrival") ? 8 : 5,
        color: COLOR[e.event_type] ?? "hsl(var(--primary))", weight: 2, fillOpacity: 0.6,
      }).bindPopup(`<b>${LABEL[e.event_type] ?? e.event_type}</b><br/>${e.provider_name ?? ""}<br/>${new Date(e.created_at).toLocaleString("pt-BR")}`).addTo(layer);
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts.map((e) => [e.latitude!, e.longitude!] as [number, number])).pad(0.3));
  }, [events]);
  return <div ref={ref} data-testid="admin-nav-map" className="h-80 w-full rounded-lg border border-border" />;
};

export function NavigationHistoryView({ rpc, title, privacyNote }: { rpc: "admin_navigation_history" | "client_navigation_history"; title: string; privacyNote?: string }) {
  const [rows, setRows] = useState<NavEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [provider, setProvider] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.rpc(rpc as never, { _days: Number(days) } as never);
    if (error) setError("Não foi possível carregar o histórico.");
    setRows(((data as unknown) as NavEvent[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [days, rpc]); // eslint-disable-line react-hooks/exhaustive-deps

  const providers = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.provider_id && m.set(r.provider_id, r.provider_name ?? "Profissional"));
    return [...m.entries()];
  }, [rows]);
  const filtered = useMemo(() => (provider === "all" ? rows : rows.filter((r) => r.provider_id === provider)), [rows, provider]);

  const chart = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    filtered.forEach((r) => {
      const d = r.created_at.slice(0, 10);
      const o = m.get(d) ?? { dia: d.slice(8, 10) + "/" + d.slice(5, 7), navegacoes: 0, chegadasGps: 0, chegadasBotao: 0 };
      if (r.event_type === "navigation_started") (o.navegacoes as number)++;
      if (r.event_type === "arrival_confirmed") (o.chegadasGps as number)++;
      if (r.event_type === "provider_manual_arrival") (o.chegadasBotao as number)++;
      m.set(d, o);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filtered]);

  const perProvider = useMemo(() => {
    const m = new Map<string, { name: string; nav: number; gps: number; btn: number; last: string }>();
    filtered.forEach((r) => {
      if (!r.provider_id) return;
      const o = m.get(r.provider_id) ?? { name: r.provider_name ?? "Profissional", nav: 0, gps: 0, btn: 0, last: r.created_at };
      if (r.event_type === "navigation_started") o.nav++;
      if (r.event_type === "arrival_confirmed") o.gps++;
      if (r.event_type === "provider_manual_arrival") o.btn++;
      if (r.created_at > o.last) o.last = r.created_at;
      m.set(r.provider_id, o);
    });
    return [...m.entries()];
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-6 space-y-6" data-testid="admin-nav-history">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">{title}</h1>{privacyNote && <p className="text-sm text-muted-foreground">{privacyNote}</p>}</div>
          <div className="flex gap-2">
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Profissional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {providers.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["7", "30", "90", "365"].map((d) => <SelectItem key={d} value={d}>{d} dias</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load} aria-label="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">Mapa dos eventos</CardTitle></CardHeader>
                <CardContent><EventsMap events={filtered} /></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Por dia</CardTitle></CardHeader>
                <CardContent className="h-80" data-testid="admin-nav-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Bar dataKey="navegacoes" name="Navegações" fill="hsl(var(--primary))" />
                      <Bar dataKey="chegadasGps" name="Chegadas GPS" fill="hsl(var(--muted-foreground))" />
                      <Bar dataKey="chegadasBotao" name="Chegadas botão" fill="hsl(var(--destructive))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle className="text-base">Por profissional</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-left"><tr><th className="py-2">Profissional</th><th>Navegações</th><th>Chegadas GPS</th><th>Chegadas botão</th><th>Última ação</th></tr></thead>
                  <tbody>{perProvider.map(([id, p]) => (
                    <tr key={id} className="border-t border-border cursor-pointer hover:bg-accent" onClick={() => setProvider(id)}>
                      <td className="py-2 font-medium">{p.name}</td><td>{p.nav}</td><td>{p.gps}</td><td>{p.btn}</td>
                      <td>{new Date(p.last).toLocaleString("pt-BR")}</td></tr>))}
                    {!perProvider.length && <tr><td colSpan={5} className="py-4 text-muted-foreground">Nenhum evento no período.</td></tr>}
                  </tbody>
                </table>
              </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Linha do tempo ({filtered.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
                {filtered.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-sm">
                    <Badge variant="secondary">{LABEL[e.event_type] ?? e.event_type}</Badge>
                    <span className="font-medium">{e.provider_name ?? "—"}</span>
                    <Link to={`/servico/${e.service_id}/rastreio`} className="text-primary underline truncate max-w-[16rem]">{e.service_title ?? "Serviço"}</Link>
                    {e.source && <span className="text-muted-foreground">· {e.source === "GPS" ? "GPS" : "Botão"}</span>}
                    {typeof e.metadata?.app === "string" && <span className="text-muted-foreground">· {String(e.metadata.app)}</span>}
                    <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </CardContent></Card>
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminNavigationHistory() {
  return <NavigationHistoryView rpc="admin_navigation_history" title="Navegações e chegadas" />;
}
