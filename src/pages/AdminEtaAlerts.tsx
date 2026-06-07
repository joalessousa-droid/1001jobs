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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertTriangle, Search, RefreshCw, Eye, Mail, Webhook, CalendarIcon, ArrowUpDown, Download, FileJson, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface EtaAlert {
  id: string; ts: string; alert_type: string; severity: string;
  period_from: string; period_to: string;
  city: string | null; provider_id: string | null; category_id: string | null;
  samples: number | null; failures: number | null; failure_rate: number | null;
  avg_duration_ms: number | null; p95_duration_ms: number | null; avg_traffic_factor: number | null;
  summary: any; tuning_snapshot: any;
  email_sent: boolean; webhook_status: number | null; webhook_error: string | null;
}
interface Delivery {
  id: string; alert_id: string; channel: string; target: string; target_label: string | null;
  status: string; http_status: number | null; attempts: number; last_error: string | null;
  last_attempt_at: string | null;
  signature: string | null; signature_algo: string | null;
}

const SEV_COLORS: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/80 text-destructive-foreground",
  medium: "bg-amber-500 text-white",
  low: "bg-muted text-muted-foreground",
};
const SEV_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

type SortKey = "ts" | "severity" | "p95" | "failure_rate";
type GroupKey = "none" | "city" | "category";

const AdminEtaAlerts = () => {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<EtaAlert[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EtaAlert | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => new Date(Date.now() - 7 * 86400_000));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => new Date());
  const [sortBy, setSortBy] = useState<SortKey>("ts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");

  useEffect(() => { if (!roleLoading && !isAdmin) navigate("/dashboard"); }, [isAdmin, roleLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const from = (dateFrom ?? new Date(Date.now() - 7 * 86400_000)).toISOString();
    const to = (dateTo ?? new Date()).toISOString();
    let q = supabase.from("eta_alerts" as any).select("*").gte("ts", from).lte("ts", to).order("ts", { ascending: false }).limit(1000);
    if (type !== "all") q = q.eq("alert_type", type);
    if (city) q = q.ilike("city", `%${city}%`);
    if (category) q = q.eq("category_id", category);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    const list = (data as any) ?? [];
    setAlerts(list);
    if (list.length) {
      const ids = list.map((a: EtaAlert) => a.id);
      const { data: dlv } = await supabase.from("eta_alert_deliveries" as any).select("*").in("alert_id", ids);
      setDeliveries((dlv as any) ?? []);
    } else setDeliveries([]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, type, city, category, dateFrom, dateTo]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel("eta-alerts-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "eta_alerts" }, (p: any) => {
        setAlerts((cur) => [p.new as EtaAlert, ...cur].slice(0, 1000));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "eta_alert_deliveries" }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? alerts.filter((a) => JSON.stringify(a).toLowerCase().includes(q)) : alerts;
    const sorted = [...base].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "severity": return dir * ((SEV_RANK[a.severity] ?? 0) - (SEV_RANK[b.severity] ?? 0));
        case "p95": return dir * ((a.p95_duration_ms ?? 0) - (b.p95_duration_ms ?? 0));
        case "failure_rate": return dir * ((a.failure_rate ?? 0) - (b.failure_rate ?? 0));
        default: return dir * (new Date(a.ts).getTime() - new Date(b.ts).getTime());
      }
    });
    return sorted;
  }, [alerts, search, sortBy, sortDir]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "Todos", items: filteredSorted }];
    const m = new Map<string, EtaAlert[]>();
    for (const a of filteredSorted) {
      const k = (groupBy === "city" ? a.city : a.category_id) ?? "—";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([key, items]) => ({ key, items }));
  }, [filteredSorted, groupBy]);

  const deliveriesFor = (id: string) => deliveries.filter((d) => d.alert_id === id);
  const toggleSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(k); setSortDir("desc"); }
  };

  const flattenedForExport = () => grouped.flatMap((g) =>
    g.items.map((a) => {
      const dlvs = deliveriesFor(a.id);
      return {
        group: g.key,
        ts: a.ts, alert_type: a.alert_type, severity: a.severity,
        city: a.city ?? "", category_id: a.category_id ?? "", provider_id: a.provider_id ?? "",
        samples: a.samples ?? 0, failures: a.failures ?? 0,
        failure_rate: a.failure_rate ?? 0,
        avg_duration_ms: a.avg_duration_ms ?? 0, p95_duration_ms: a.p95_duration_ms ?? 0,
        avg_traffic_factor: a.avg_traffic_factor ?? 0,
        email_sent: a.email_sent, webhook_status: a.webhook_status ?? "",
        deliveries_total: dlvs.length,
        deliveries_ok: dlvs.filter((d) => d.status === "sent").length,
        deliveries_failed: dlvs.filter((d) => d.status === "failed").length,
      };
    }),
  );

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const rows = flattenedForExport();
    if (!rows.length) return toast.info("Nada para exportar");
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(","))].join("\n");
    downloadBlob(csv, `eta-alerts-${Date.now()}.csv`, "text/csv;charset=utf-8");
    toast.success(`${rows.length} linhas exportadas`);
  };

  const exportJSON = () => {
    const rows = flattenedForExport();
    if (!rows.length) return toast.info("Nada para exportar");
    const payload = {
      generated_at: new Date().toISOString(),
      filters: { dateFrom, dateTo, type, city, category, search, sortBy, sortDir, groupBy },
      total: rows.length,
      groups: grouped.map((g) => ({ key: g.key, count: g.items.length })),
      alerts: grouped.flatMap((g) => g.items.map((a) => ({ ...a, group: g.key, deliveries: deliveriesFor(a.id) }))),
    };
    downloadBlob(JSON.stringify(payload, null, 2), `eta-alerts-${Date.now()}.json`, "application/json");
    toast.success(`${rows.length} alertas exportados`);
  };

  if (roleLoading || !isAdmin) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-destructive" /> Histórico de alertas ETA
          </h1>
          <p className="text-sm text-muted-foreground">Auditoria de degradações persistentes detectadas pelo monitor automático. Atualização em tempo real.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm"><Link to="/admin/eta/config"><Settings className="w-4 h-4 mr-1" /> Templates & webhooks</Link></Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={exportJSON}><FileJson className="w-4 h-4 mr-1" /> JSON</Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <Label className="text-xs">Período (de → até)</Label>
          <div className="flex gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal text-xs", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {dateFrom ? format(dateFrom, "dd/MM/yy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal text-xs", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {dateTo ? format(dateTo, "dd/MM/yy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
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
          <Label className="text-xs">Agrupar por</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem agrupamento</SelectItem>
              <SelectItem value="city">Cidade</SelectItem>
              <SelectItem value="category">Categoria</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Busca livre</Label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-7" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="erro, provider…" />
          </div>
        </div>
      </Card>

      {grouped.map((g) => (
        <Card key={g.key} className="p-0 overflow-hidden">
          {groupBy !== "none" && (
            <div className="px-3 py-2 bg-muted/30 text-xs font-semibold flex items-center justify-between border-b border-border">
              <span>{groupBy === "city" ? "Cidade" : "Categoria"}: {g.key}</span>
              <Badge variant="outline">{g.items.length}</Badge>
            </div>
          )}
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left p-2 cursor-pointer select-none" onClick={() => toggleSort("ts")}>
                  Data <ArrowUpDown className="inline w-3 h-3 opacity-50" />
                </th>
                <th className="text-left p-2">Tipo</th>
                <th className="text-left p-2 cursor-pointer select-none" onClick={() => toggleSort("severity")}>
                  Sev <ArrowUpDown className="inline w-3 h-3 opacity-50" />
                </th>
                <th className="text-left p-2">Cidade</th>
                <th className="text-right p-2 cursor-pointer select-none" onClick={() => toggleSort("failure_rate")}>
                  Falhas <ArrowUpDown className="inline w-3 h-3 opacity-50" />
                </th>
                <th className="text-right p-2 cursor-pointer select-none" onClick={() => toggleSort("p95")}>
                  p95 <ArrowUpDown className="inline w-3 h-3 opacity-50" />
                </th>
                <th className="text-right p-2">Trans.</th>
                <th className="text-center p-2">Notif</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((a) => {
                const dlvs = deliveriesFor(a.id);
                const okCount = dlvs.filter((d) => d.status === "sent").length;
                return (
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
                      <div className="flex items-center justify-center gap-1" title={`${okCount}/${dlvs.length} entregues`}>
                        <Mail className={`w-3 h-3 ${a.email_sent ? "text-green-500" : "text-muted-foreground"}`} />
                        <Webhook className={`w-3 h-3 ${a.webhook_status && a.webhook_status < 400 ? "text-green-500" : a.webhook_status ? "text-destructive" : "text-muted-foreground"}`} />
                        {dlvs.length > 0 && <span className="text-[10px] text-muted-foreground">{okCount}/{dlvs.length}</span>}
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelected(a)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {g.items.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-6">Nenhum alerta no período/filtros.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      ))}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                <div className="font-semibold mb-1">Entregas por destinatário</div>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr><th className="text-left p-1.5">Canal</th><th className="text-left p-1.5">Destino</th><th className="text-center p-1.5">Assin.</th><th className="text-center p-1.5">Status</th><th className="text-center p-1.5">HTTP</th><th className="text-center p-1.5">Tent.</th><th className="text-left p-1.5">Erro</th></tr>
                    </thead>
                    <tbody>
                      {deliveriesFor(selected.id).map((d) => (
                        <tr key={d.id} className="border-t border-border">
                          <td className="p-1.5">{d.channel}</td>
                          <td className="p-1.5 truncate max-w-[180px]" title={d.target}>{d.target_label ?? d.target}</td>
                          <td className="p-1.5 text-center">
                            {d.signature ? (
                              <Badge variant="secondary" className="text-[10px]" title={`${d.signature_algo}: ${d.signature.slice(0, 16)}…`}>
                                {d.signature_algo ?? "hmac"}
                              </Badge>
                            ) : <span className="text-[10px] text-muted-foreground">—</span>}
                          </td>
                          <td className="p-1.5 text-center">
                            <Badge variant={d.status === "sent" ? "default" : "destructive"} className="text-[10px]">{d.status}</Badge>
                          </td>
                          <td className="p-1.5 text-center tabular-nums">{d.http_status ?? "—"}</td>
                          <td className="p-1.5 text-center tabular-nums">{d.attempts}</td>
                          <td className="p-1.5 text-destructive truncate max-w-[160px]" title={d.last_error ?? ""}>{d.last_error ?? ""}</td>
                        </tr>
                      ))}
                      {deliveriesFor(selected.id).length === 0 && (
                        <tr><td colSpan={7} className="text-center text-muted-foreground py-2">Nenhuma entrega registrada.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-1">Resumo</div>
                <pre className="bg-muted/40 p-3 rounded text-[11px] overflow-auto">{JSON.stringify(selected.summary, null, 2)}</pre>
              </div>
              <div>
                <div className="font-semibold mb-1">Tuning ativo no momento</div>
                <pre className="bg-muted/40 p-3 rounded text-[11px] overflow-auto max-h-64">{JSON.stringify(selected.tuning_snapshot, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEtaAlerts;
