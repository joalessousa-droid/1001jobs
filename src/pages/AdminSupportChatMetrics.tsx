import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Sparkles, AlertTriangle, Clock, MessageSquare, Activity, Bell, Pencil, Mail, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Metrics = {
  period_from: string; period_to: string;
  total_questions: number; answered: number;
  rate_limited_429: number; credits_exhausted_402: number; errors: number;
  avg_response_time_ms: number; p95_response_time_ms: number;
  unique_users: number; total_tokens: number;
  top_intents: { category: string; count: number }[];
  daily_volume: { day: string; total: number; errors: number }[];
};
type LogRow = {
  id: string; created_at: string; question: string | null;
  intent_category: string | null; status: string; http_status: number | null;
  response_time_ms: number | null; error_message: string | null;
  session_id: string | null; is_pro: boolean | null; intent_corrected: boolean | null;
};
type Alerts = {
  generated_at: string;
  recent: { total: number; rate_limited: number; credits_exhausted: number; errors: number };
  baseline: { total: number; rate_limited: number; credits_exhausted: number; errors: number };
  alerts: { type: string; severity: string; message: string; count: number }[];
};
type SegmentMetrics = Record<string, {
  total: number; answered: number; rate_limited_429: number;
  credits_exhausted_402: number; errors: number;
  avg_response_ms: number; p95_response_ms: number;
  top_intents: { intent: string; count: number }[];
}>;

const INTENT_OPTIONS = [
  "pagamento","disputa","avaliacao","chat","kyc_verificacao","cadastro_login",
  "tarefas","plano_pro","afiliados","perfil","precificacao","cancelamento","suporte_humano","outros",
];

const fmtDateInput = (d: Date) => d.toISOString().slice(0, 10);

const AdminSupportChatMetrics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [from, setFrom] = useState(fmtDateInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(fmtDateInput(new Date()));
  const [segment, setSegment] = useState<"all" | "pro" | "free" | "anon">("all");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [segmented, setSegmented] = useState<SegmentMetrics>({});
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportSending, setReportSending] = useState(false);

  // Modal de correção
  const [correctionLog, setCorrectionLog] = useState<LogRow | null>(null);
  const [newIntent, setNewIntent] = useState("outros");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles" as any).select("role").eq("user_id", user.id);
      const roles = (data ?? []).map((r: any) => r.role);
      setIsAdmin(roles.includes("admin") || roles.includes("moderator"));
    })();
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      let logsQ = supabase
        .from("support_chat_logs" as any)
        .select("id, created_at, question, intent_category, status, http_status, response_time_ms, error_message, session_id, is_pro, intent_corrected")
        .gte("created_at", fromIso).lte("created_at", toIso)
        .order("created_at", { ascending: false }).limit(150);
      if (segment === "pro") logsQ = logsQ.eq("is_pro", true);
      else if (segment === "free") logsQ = logsQ.eq("is_pro", false);
      else if (segment === "anon") logsQ = logsQ.is("is_pro", null);

      const [{ data: m, error: e1 }, { data: seg, error: e3 }, { data: l, error: e2 }] = await Promise.all([
        supabase.rpc("get_support_chat_metrics" as any, { _from: fromIso, _to: toIso }),
        supabase.rpc("get_support_chat_metrics_segmented" as any, { _from: fromIso, _to: toIso }),
        logsQ,
      ]);
      if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;
      setMetrics(m as unknown as Metrics);
      setSegmented((seg ?? {}) as unknown as SegmentMetrics);
      setLogs((l ?? []) as unknown as LogRow[]);
    } catch (e: any) {
      toast({ title: "Erro ao carregar métricas", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [from, to, segment, toast]);

  const loadAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_support_chat_alerts" as any);
      if (error) throw error;
      setAlerts(data as unknown as Alerts);
    } catch (e: any) {
      console.error("alerts error", e);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);
  useEffect(() => {
    if (!isAdmin) return;
    loadAlerts();
    const t = setInterval(loadAlerts, 30_000);
    return () => clearInterval(t);
  }, [isAdmin, loadAlerts]);

  const successRate = useMemo(() => {
    if (!metrics?.total_questions) return 0;
    return Math.round((metrics.answered / metrics.total_questions) * 100);
  }, [metrics]);

  const openCorrection = (l: LogRow) => {
    setCorrectionLog(l);
    setNewIntent(l.intent_category || "outros");
    setCorrectionNotes("");
  };

  const saveCorrection = async () => {
    if (!correctionLog) return;
    setSavingCorrection(true);
    try {
      const { error } = await supabase.rpc("apply_intent_correction" as any, {
        _log_id: correctionLog.id,
        _corrected_intent: newIntent,
        _notes: correctionNotes || null,
      });
      if (error) throw error;
      toast({ title: "Intenção corrigida", description: "A correção foi adicionada à base de treinamento." });
      setCorrectionLog(null);
      load();
    } catch (e: any) {
      toast({ title: "Falha ao corrigir", description: e.message, variant: "destructive" });
    } finally { setSavingCorrection(false); }
  };

  const triggerWeeklyReport = async () => {
    setReportSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-chat-weekly-report", { body: {} });
      if (error) throw error;
      const status = (data as any)?.email_status ?? "ok";
      toast({
        title: "Relatório gerado",
        description: status === "sent"
          ? "Relatório enviado por e-mail."
          : status === "skipped_no_provider"
            ? "Relatório arquivado. Configure RESEND_API_KEY para envio por e-mail."
            : `Status do envio: ${status}`,
      });
    } catch (e: any) {
      toast({ title: "Falha ao gerar relatório", description: e.message, variant: "destructive" });
    } finally { setReportSending(false); }
  };

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md"><CardContent className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
        </CardContent></Card>
      </div>
    );
  }

  const activeAlerts = alerts?.alerts ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Métricas do Chatbot Ana
            </h1>
            <p className="text-sm text-muted-foreground">Perguntas, erros, intenções, segmentos e alertas em tempo real.</p>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">De</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Até</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Segmento</label>
              <Select value={segment} onValueChange={(v: any) => setSegment(v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="anon">Anônimo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={load} disabled={loading} variant="outline">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button onClick={triggerWeeklyReport} disabled={reportSending}>
              {reportSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Relatório semanal
            </Button>
          </div>
        </div>

        {/* Painel de alertas */}
        <Card className={activeAlerts.length ? "border-destructive/60" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className={`w-4 h-4 ${activeAlerts.length ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
              Alertas em tempo real
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                Janela: 15min · atualiza a cada 30s
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!alerts ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : activeAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ✅ Nenhum alerta ativo. {alerts.recent.total} requisições nos últimos 15min.
              </p>
            ) : (
              <div className="space-y-2">
                {activeAlerts.map((a, i) => (
                  <div key={i} className={`p-3 rounded-md border flex items-start gap-3 ${
                    a.severity === "critical" ? "border-destructive bg-destructive/5"
                    : a.severity === "high" ? "border-amber-500 bg-amber-500/5"
                    : "border-border bg-muted/30"
                  }`}>
                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                      a.severity === "critical" ? "text-destructive"
                      : a.severity === "high" ? "text-amber-500" : "text-muted-foreground"
                    }`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{a.message}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Tipo: {a.type} · Severidade: {a.severity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={<MessageSquare className="w-4 h-4" />} label="Perguntas" value={metrics?.total_questions ?? 0} />
          <Kpi icon={<Activity className="w-4 h-4 text-emerald-500" />} label="Respondidas" value={`${metrics?.answered ?? 0} (${successRate}%)`} />
          <Kpi icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} label="Rate-limit (429)" value={metrics?.rate_limited_429 ?? 0} />
          <Kpi icon={<AlertTriangle className="w-4 h-4 text-destructive" />} label="Sem crédito (402)" value={metrics?.credits_exhausted_402 ?? 0} />
          <Kpi icon={<AlertTriangle className="w-4 h-4 text-destructive" />} label="Outros erros" value={metrics?.errors ?? 0} />
          <Kpi icon={<Clock className="w-4 h-4" />} label="Tempo médio" value={`${metrics?.avg_response_time_ms ?? 0} ms`} />
          <Kpi icon={<Clock className="w-4 h-4" />} label="P95" value={`${metrics?.p95_response_time_ms ?? 0} ms`} />
          <Kpi icon={<MessageSquare className="w-4 h-4" />} label="Usuários únicos" value={metrics?.unique_users ?? 0} />
        </div>

        {/* Segmentos */}
        <Card>
          <CardHeader><CardTitle className="text-base">Performance por segmento</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="py-2 pr-2">Segmento</th>
                  <th className="py-2 pr-2 text-right">Total</th>
                  <th className="py-2 pr-2 text-right">Sucesso</th>
                  <th className="py-2 pr-2 text-right">429</th>
                  <th className="py-2 pr-2 text-right">402</th>
                  <th className="py-2 pr-2 text-right">Erros</th>
                  <th className="py-2 pr-2 text-right">Médio</th>
                  <th className="py-2 pr-2 text-right">P95</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(segmented).map(([k, v]) => (
                  <tr key={k} className="border-t border-border/40">
                    <td className="py-2 pr-2 font-medium capitalize">{k}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{v.total}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-500">{v.answered}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-amber-500">{v.rate_limited_429}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-destructive">{v.credits_exhausted_402}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-destructive">{v.errors}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{v.avg_response_ms} ms</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{v.p95_response_ms} ms</td>
                  </tr>
                ))}
                {!Object.keys(segmented).length && (
                  <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Sem dados.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Top intents */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top intenções por categoria</CardTitle></CardHeader>
          <CardContent>
            {!metrics?.top_intents?.length ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="space-y-2">
                {metrics.top_intents.map((t) => {
                  const max = metrics.top_intents[0].count || 1;
                  const pct = Math.round((t.count / max) * 100);
                  return (
                    <div key={t.category} className="flex items-center gap-3">
                      <div className="w-40 text-sm capitalize">{t.category.replace(/_/g, " ")}</div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-12 text-right text-sm tabular-nums">{t.count}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs com revisão */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Últimas interações
              <span className="text-xs font-normal text-muted-foreground ml-2">
                {segment !== "all" ? `(filtro: ${segment})` : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="py-2 pr-2">Quando</th>
                  <th className="py-2 pr-2">Plano</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Categoria</th>
                  <th className="py-2 pr-2">Tempo</th>
                  <th className="py-2 pr-2">Pergunta</th>
                  <th className="py-2 pr-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-border/40">
                    <td className="py-2 pr-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-2">
                      {l.is_pro === true ? <Badge className="bg-primary/15 text-primary border-primary/25">Pro</Badge>
                        : l.is_pro === false ? <Badge variant="outline">Free</Badge>
                        : <Badge variant="outline" className="opacity-60">Anon</Badge>}
                    </td>
                    <td className="py-2 pr-2">
                      <Badge variant={l.status === "success" ? "secondary" : "destructive"}>
                        {l.status}{l.http_status ? ` · ${l.http_status}` : ""}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2 capitalize">
                      {(l.intent_category || "-").replace(/_/g, " ")}
                      {l.intent_corrected && <span className="ml-1 text-[10px] text-emerald-500">✓ revisado</span>}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{l.response_time_ms ?? "-"} ms</td>
                    <td className="py-2 pr-2 max-w-[380px] truncate" title={l.question ?? ""}>
                      {l.question || <span className="text-muted-foreground">—</span>}
                      {l.error_message && (
                        <span className="block text-xs text-destructive truncate">{l.error_message}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {l.question && (
                        <Button size="sm" variant="ghost" onClick={() => openCorrection(l)}>
                          <Pencil className="w-3 h-3 mr-1" /> Corrigir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Sem interações no período.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Modal de correção */}
      <Dialog open={!!correctionLog} onOpenChange={(o) => !o && setCorrectionLog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Corrigir intenção classificada</DialogTitle></DialogHeader>
          {correctionLog && (
            <div className="space-y-3">
              <div className="text-sm bg-muted/40 p-3 rounded">
                <div className="text-xs text-muted-foreground mb-1">Pergunta original</div>
                <div>{correctionLog.question}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  Classificada como: <span className="capitalize">{(correctionLog.intent_category || "-").replace(/_/g, " ")}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Categoria correta</label>
                <Select value={newIntent} onValueChange={setNewIntent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTENT_OPTIONS.map((i) => (
                      <SelectItem key={i} value={i} className="capitalize">{i.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notas (opcional)</label>
                <Input value={correctionNotes} onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="Por que está errado, contexto..." />
              </div>
              <p className="text-xs text-muted-foreground">
                A correção será adicionada à base de treinamento e usada para melhorar a classificação automática nas próximas perguntas similares.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionLog(null)}>Cancelar</Button>
            <Button onClick={saveCorrection} disabled={savingCorrection}>
              {savingCorrection && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar correção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Kpi = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <Card><CardContent className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
    <div className="text-xl font-semibold tabular-nums">{value}</div>
  </CardContent></Card>
);

export default AdminSupportChatMetrics;
