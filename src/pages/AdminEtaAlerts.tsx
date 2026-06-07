import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Search, RefreshCw, Eye, Mail, Webhook } from "lucide-react";
import { toast } from "sonner";

interface EtaAlert {
  id: string; ts: string; alert_type: string; severity: string;
  period_from: string; period_to: string;
  city: string | null; provider_id: string | null; category_id: string | null;
  samples: number | null; failures: number | null; failure_rate: number | null;
  avg_duration_ms: number | null; p95_duration_ms: number | null; avg_traffic_factor: number | null;
  summary: any; tuning_snapshot: any;
  email_sent: boolean; webhook_status: number | null; webhook_error: string | null;
}

const SEV_COLORS: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/80 text-destructive-foreground",
  medium: "bg-amber-500 text-white",
  low: "bg-muted text-muted-foreground",
};

const AdminEtaAlerts = () => {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<EtaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<string>("all");
  const [period, setPeriod] = useState<string>("7d");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EtaAlert | null>(null);

  useEffect(() => { if (!roleLoading && !isAdmin) navigate("/dashboard"); }, [isAdmin, roleLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const periodMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = periodMap[period] ?? 7;
    const from = new Date(Date.now() - days * 86400_000).toISOString();
    let q = supabase.from("eta_alerts" as any).select("*").gte("ts", from).order("ts", { ascending: false }).limit(500);
    if (type !== "all") q = q.eq("alert_type", type);
    if (city) q = q.ilike("city", `%${city}%`);
    if (category) q = q.eq("category_id", category);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setAlerts((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, type, city, category, period]);

  // Realtime: prepend new alerts as they arrive
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel("eta-alerts-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "eta_alerts" }, (p: any) => {
        setAlerts((cur) => [p.new as EtaAlert, ...cur].slice(0, 500));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter((a) =>
      JSON.stringify(a).toLowerCase().includes(q),
    );
  }, [alerts, search]);

  if (roleLoading || !isAdmin) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-destructive" /> Histórico de alertas ETA
          </h1>
          <p className="text-sm text-muted-foreground">
            Auditoria de degradações persistentes detectadas pelo monitor automático.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <Label className="text-xs">Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Último dia</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="persistent_degradation">Degradação persistente</SelectItem>
              <SelectItem value="slow_responses">Respostas lentas</SelectItem>
              <SelectItem value="intense_traffic">Trânsito intenso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Cidade</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" />
        </div>
        <div>
          <Label className="text-xs">Categoria (UUID)</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="opcional" />
        </div>
        <div className="md:col-span-1">
          <Label className="text-xs">Busca livre</Label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-7" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="erro, provider…" />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Sev</th>
              <th className="text-left p-2">Cidade</th>
              <th className="text-right p-2">Falhas</th>
              <th className="text-right p-2">p95</th>
              <th className="text-right p-2">Trans.</th>
              <th className="text-center p-2">Notif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-2 tabular-nums">{new Date(a.ts).toLocaleString()}</td>
                <td className="p-2"><Badge variant="outline">{a.alert_type}</Badge></td>
                <td className="p-2"><Badge className={SEV_COLORS[a.severity] ?? ""}>{a.severity}</Badge></td>
                <td className="p-2">{a.city ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">
                  {a.failures ?? 0}/{a.samples ?? 0}
                  <span className="text-muted-foreground"> ({((a.failure_rate ?? 0) * 100).toFixed(0)}%)</span>
                </td>
                <td className="p-2 text-right tabular-nums">{a.p95_duration_ms ?? 0}ms</td>
                <td className="p-2 text-right tabular-nums">{a.avg_traffic_factor?.toFixed(2) ?? "—"}</td>
                <td className="p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Mail className={`w-3 h-3 ${a.email_sent ? "text-green-500" : "text-muted-foreground"}`} />
                    <Webhook className={`w-3 h-3 ${a.webhook_status && a.webhook_status < 400 ? "text-green-500" : a.webhook_status ? "text-destructive" : "text-muted-foreground"}`} />
                  </div>
                </td>
                <td className="p-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelected(a)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted-foreground py-6">Nenhum alerta no período/filtros.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Alerta {selected?.alert_type}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Período:</span> {new Date(selected.period_from).toLocaleString()} → {new Date(selected.period_to).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Cidade:</span> {selected.city ?? "—"}</div>
                <div><span className="text-muted-foreground">Provider:</span> {selected.provider_id ?? "—"}</div>
                <div><span className="text-muted-foreground">Categoria:</span> {selected.category_id ?? "—"}</div>
              </div>
              <div>
                <div className="font-semibold mb-1">Resumo</div>
                <pre className="bg-muted/40 p-3 rounded text-[11px] overflow-auto">{JSON.stringify(selected.summary, null, 2)}</pre>
              </div>
              <div>
                <div className="font-semibold mb-1">Tuning ativo no momento</div>
                <pre className="bg-muted/40 p-3 rounded text-[11px] overflow-auto max-h-64">{JSON.stringify(selected.tuning_snapshot, null, 2)}</pre>
              </div>
              {selected.webhook_error && (
                <div className="text-xs text-destructive">Webhook erro: {selected.webhook_error}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEtaAlerts;
