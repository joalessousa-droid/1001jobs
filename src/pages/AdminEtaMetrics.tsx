import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Activity, Gauge, RefreshCw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Dashboard {
  generated_at: string;
  window_minutes: number;
  totals: {
    samples: number; failures: number; failure_rate: number; degraded: number;
    avg_duration_ms: number; p95_duration_ms: number;
    avg_traffic_factor: number;
    traffic_levels: Record<string, number> | null;
    total_retries: number;
  };
  timeseries: Array<{ bucket: string; samples: number; failures: number; avg_duration_ms: number; avg_traffic_factor: number }>;
  recent_errors: Array<{ ts: string; service_id: string | null; http_status: number | null; retries: number; error: string }>;
  alerts: { persistent_degradation: boolean; slow_responses: boolean; intense_traffic_share: number };
}

interface Override {
  id: string;
  scope: "global" | "city" | "provider" | "category";
  scope_value: string | null;
  ema_alpha: number | null;
  max_regional_weight: number | null;
  hour_of_day: number | null;
  day_of_week: number | null;
  notes: string | null;
  is_active: boolean;
}

const Sparkline = ({ data, accessor, color = "hsl(var(--primary))" }: { data: any[]; accessor: (d: any) => number; color?: string }) => {
  if (!data || data.length < 2) return <div className="text-xs text-muted-foreground">Sem dados</div>;
  const values = data.map(accessor);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(1, max - min);
  const w = 320, h = 60;
  const step = (w - 8) / (data.length - 1);
  const pts = values.map((v, i) => `${i === 0 ? "M" : "L"}${(4 + i * step).toFixed(1)},${(h - 6 - ((v - min) / span) * (h - 14)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <path d={pts} stroke={color} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const AdminEtaMetrics = () => {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [minutes, setMinutes] = useState(60);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Partial<Override>>({ scope: "global", is_active: true });

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate("/dashboard");
  }, [isAdmin, roleLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: dash, error }, { data: ov }] = await Promise.all([
      supabase.rpc("get_eta_metrics_dashboard" as any, { _minutes: minutes }),
      supabase.from("eta_tuning_overrides" as any).select("*").order("scope").order("created_at", { ascending: false }),
    ]);
    if (error) toast.error("Falha ao carregar métricas: " + error.message);
    setData((dash as any) ?? null);
    setOverrides((ov as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, minutes]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!isAdmin) return;
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [isAdmin, minutes]);

  const addOverride = async () => {
    const payload: any = {
      scope: draft.scope ?? "global",
      scope_value: draft.scope_value || null,
      ema_alpha: draft.ema_alpha ?? null,
      max_regional_weight: draft.max_regional_weight ?? null,
      hour_of_day: draft.hour_of_day ?? null,
      day_of_week: draft.day_of_week ?? null,
      notes: draft.notes || null,
      is_active: true,
    };
    const { error } = await supabase.from("eta_tuning_overrides" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Override criado");
    setDraft({ scope: "global", is_active: true });
    void load();
  };

  const removeOverride = async (id: string) => {
    const { error } = await supabase.from("eta_tuning_overrides" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  if (roleLoading || !isAdmin) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const t = data?.totals;
  const alerts = data?.alerts;
  const persistent = alerts?.persistent_degradation;
  const slow = alerts?.slow_responses;

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Métricas do ETA
          </h1>
          <p className="text-sm text-muted-foreground">
            Taxa de falha, tempo de resposta e qualidade do trânsito do mecanismo de rotas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">Últimos 15min</SelectItem>
              <SelectItem value="60">Última 1h</SelectItem>
              <SelectItem value="360">Últimas 6h</SelectItem>
              <SelectItem value="1440">Último dia</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {(persistent || slow) && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div className="space-y-1 text-sm">
              <div className="font-semibold text-destructive">Degradação detectada</div>
              {persistent && <div>Taxa de falha &gt; 25% nos últimos 15 minutos com volume relevante.</div>}
              {slow && <div>p95 do tempo de resposta acima de 3s nos últimos 15 minutos.</div>}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Amostras</div>
          <div className="text-2xl font-bold tabular-nums">{t?.samples ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">{t?.total_retries ?? 0} retries</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Taxa de falha</div>
          <div className={`text-2xl font-bold tabular-nums ${t && t.failure_rate > 0.1 ? "text-destructive" : ""}`}>
            {((t?.failure_rate ?? 0) * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">{t?.failures ?? 0} falhas</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">p95 resposta</div>
          <div className={`text-2xl font-bold tabular-nums ${t && t.p95_duration_ms > 3000 ? "text-destructive" : ""}`}>
            {t?.p95_duration_ms ?? 0}<span className="text-sm font-normal">ms</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">média {t?.avg_duration_ms ?? 0}ms</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Fator trânsito médio</div>
          <div className="text-2xl font-bold tabular-nums">{(t?.avg_traffic_factor ?? 0).toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
            {t?.traffic_levels && Object.entries(t.traffic_levels).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-[10px]">{k}: {v as number}</Badge>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2"><Gauge className="w-4 h-4" /> Duração média (ms) por minuto</div>
          <span className="text-xs text-muted-foreground">{data?.timeseries.length ?? 0} pontos</span>
        </div>
        <Sparkline data={data?.timeseries ?? []} accessor={(d) => d.avg_duration_ms} />
        <div className="text-sm font-semibold mt-3">Falhas por minuto</div>
        <Sparkline data={data?.timeseries ?? []} accessor={(d) => d.failures} color="hsl(var(--destructive))" />
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">Erros recentes</div>
        {data?.recent_errors.length ? (
          <ul className="space-y-1 text-xs max-h-64 overflow-auto">
            {data.recent_errors.map((e, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-border/40 pb-1">
                <span className="text-muted-foreground tabular-nums">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="font-mono truncate">{e.error}</span>
                <span className="tabular-nums">HTTP {e.http_status ?? "—"} · {e.retries}x</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum erro no período.</p>
        )}
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Configuração (EMA / regional weight)</h2>
          <p className="text-xs text-muted-foreground">
            Precedência: provider &gt; category &gt; city &gt; global. Hora/dia opcionais refinam o match.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <div>
            <Label className="text-xs">Escopo</Label>
            <Select value={draft.scope} onValueChange={(v) => setDraft({ ...draft, scope: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">global</SelectItem>
                <SelectItem value="city">city</SelectItem>
                <SelectItem value="provider">provider</SelectItem>
                <SelectItem value="category">category</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor do escopo</Label>
            <Input
              placeholder={draft.scope === "global" ? "(vazio)" : draft.scope === "city" ? "São Paulo" : "uuid"}
              value={draft.scope_value ?? ""}
              onChange={(e) => setDraft({ ...draft, scope_value: e.target.value })}
              disabled={draft.scope === "global"}
            />
          </div>
          <div>
            <Label className="text-xs">EMA alpha</Label>
            <Input type="number" step="0.01" min={0.01} max={0.95}
              value={draft.ema_alpha ?? ""}
              onChange={(e) => setDraft({ ...draft, ema_alpha: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label className="text-xs">Max regional weight</Label>
            <Input type="number" step="0.05" min={0} max={0.9}
              value={draft.max_regional_weight ?? ""}
              onChange={(e) => setDraft({ ...draft, max_regional_weight: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label className="text-xs">Hora (0-23)</Label>
            <Input type="number" min={0} max={23}
              value={draft.hour_of_day ?? ""}
              onChange={(e) => setDraft({ ...draft, hour_of_day: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label className="text-xs">Dia sem. (0-6)</Label>
            <Input type="number" min={0} max={6}
              value={draft.day_of_week ?? ""}
              onChange={(e) => setDraft({ ...draft, day_of_week: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
        <Button onClick={addOverride} size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar override</Button>

        <div className="border-t border-border pt-3">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left">Escopo</th><th className="text-left">Valor</th><th>α</th><th>maxW</th><th>h</th><th>dow</th><th></th></tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={o.id} className="border-t border-border/40">
                  <td><Badge variant="outline">{o.scope}</Badge></td>
                  <td className="truncate max-w-[180px]">{o.scope_value ?? "—"}</td>
                  <td className="text-center tabular-nums">{o.ema_alpha ?? "—"}</td>
                  <td className="text-center tabular-nums">{o.max_regional_weight ?? "—"}</td>
                  <td className="text-center tabular-nums">{o.hour_of_day ?? "—"}</td>
                  <td className="text-center tabular-nums">{o.day_of_week ?? "—"}</td>
                  <td className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => removeOverride(o.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
              {overrides.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-3">Nenhum override configurado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminEtaMetrics;
