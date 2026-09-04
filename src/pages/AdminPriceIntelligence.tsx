import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, RefreshCw } from "lucide-react";
import { formatBRL, getDemandForecast } from "@/lib/ai1001Learning";

interface PriceRow {
  category: string;
  city: string | null;
  state: string | null;
  urgency: string;
  complexity: string;
  samples: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  trend: string;
  confidence: string;
}

interface RegionRow {
  city: string;
  state: string | null;
  demand: number;
  ticket: number | null;
  median: number | null;
  avg_duration: number | null;
  cancel_rate: number | null;
  rework_rate: number | null;
  providers: number;
  top_categories: { category: string; n: number }[];
}

/** 35/19/20/45 — 1001 PRICE INTELLIGENCE + inteligência regional + demanda */
const AdminPriceIntelligence = () => {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [forecast, setForecast] = useState<Awaited<ReturnType<typeof getDemandForecast>>>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: "",
    state: "",
    city: "",
    neighborhood: "",
    urgency: "",
    complexity: "",
    days: 90,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [p, r, f] = await Promise.all([
      supabase.rpc("ai_price_intelligence", {
        _category: filters.category || null,
        _state: filters.state || null,
        _city: filters.city || null,
        _neighborhood: filters.neighborhood || null,
        _urgency: filters.urgency || null,
        _complexity: filters.complexity || null,
        _days: filters.days,
      }),
      supabase.rpc("ai_regional_intelligence", { _days: 30 }),
      getDemandForecast(filters.city || null).catch(() => []),
    ]);
    setRows((p.data as unknown as PriceRow[]) ?? []);
    setRegions((r.data as unknown as RegionRow[]) ?? []);
    setForecast(f);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LineChart className="h-6 w-6" /> 1001 Price Intelligence
            </h1>
            <p className="text-sm text-muted-foreground">
              Preços praticados, demanda e inteligência regional — sempre em dados agregados.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} data-testid="ai-price-reload">
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </header>

        <Card className="p-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="ai-price-filters">
          {(["category", "state", "city", "neighborhood", "urgency", "complexity"] as const).map((k) => (
            <Input
              key={k}
              placeholder={
                { category: "Serviço", state: "Estado", city: "Cidade", neighborhood: "Bairro", urgency: "Urgência", complexity: "Complexidade" }[k]
              }
              value={filters[k]}
              onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))}
            />
          ))}
        </Card>

        <Tabs defaultValue="prices">
          <TabsList>
            <TabsTrigger value="prices">Preços</TabsTrigger>
            <TabsTrigger value="regions">Regiões</TabsTrigger>
            <TabsTrigger value="demand">Demanda</TabsTrigger>
          </TabsList>

          <TabsContent value="prices">
            <Card className="p-4 overflow-x-auto" data-testid="ai-price-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">Serviço</th>
                    <th>Cidade</th>
                    <th>Urgência</th>
                    <th>Complexidade</th>
                    <th>Volume</th>
                    <th>Média</th>
                    <th>Mediana</th>
                    <th>P25</th>
                    <th>P75</th>
                    <th>Tendência</th>
                    <th>Confiança</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-2">{r.category}</td>
                      <td>{r.city ?? "—"}</td>
                      <td>{r.urgency}</td>
                      <td>{r.complexity}</td>
                      <td>{r.samples}</td>
                      <td>{formatBRL(r.mean)}</td>
                      <td>{formatBRL(r.median)}</td>
                      <td>{formatBRL(r.p25)}</td>
                      <td>{formatBRL(r.p75)}</td>
                      <td>{r.trend}</td>
                      <td>
                        <Badge variant="secondary">{r.confidence}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p className="text-sm text-muted-foreground">Sem observações neste filtro.</p>}
            </Card>
          </TabsContent>

          <TabsContent value="regions" className="grid gap-3 md:grid-cols-2">
            {regions.map((r, i) => (
              <Card key={i} className="p-4 space-y-1">
                <p className="font-medium">
                  {r.city} {r.state ? `· ${r.state}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Demanda: {r.demand} · Profissionais: {r.providers} · Ticket médio: {formatBRL(r.ticket)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tempo médio: {r.avg_duration ?? "—"} min · Cancelamento: {r.cancel_rate ?? 0}% · Retrabalho:{" "}
                  {r.rework_rate ?? 0}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Mais pedidos: {(r.top_categories ?? []).map((c) => `${c.category} (${c.n})`).join(", ") || "—"}
                </p>
              </Card>
            ))}
            {!regions.length && <p className="text-sm text-muted-foreground">Sem dados regionais ainda.</p>}
          </TabsContent>

          <TabsContent value="demand" className="space-y-2">
            {forecast.map((f, i) => (
              <Card key={i} className="p-4 flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{f.category ?? "Categoria"}</p>
                  <p className="text-xs text-muted-foreground">{f.city ?? "—"}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  7 dias: {f.last7} (antes {f.prev7}) ·{" "}
                  <span className={f.growth > 0 ? "text-primary" : ""}>
                    {f.growth > 0 ? "+" : ""}
                    {f.growth}%
                  </span>{" "}
                  · pico às {f.peak_hour}h
                </div>
              </Card>
            ))}
            {!forecast.length && <p className="text-sm text-muted-foreground">Sem sinal de demanda suficiente.</p>}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPriceIntelligence;
