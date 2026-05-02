import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, Clock, MessageSquare, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Metrics = {
  period_from: string;
  period_to: string;
  total_questions: number;
  answered: number;
  rate_limited_429: number;
  credits_exhausted_402: number;
  errors: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  unique_users: number;
  total_tokens: number;
  top_intents: { category: string; count: number }[];
  daily_volume: { day: string; total: number; errors: number }[];
};

type LogRow = {
  id: string;
  created_at: string;
  question: string | null;
  intent_category: string | null;
  status: string;
  http_status: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  session_id: string | null;
};

const fmtDateInput = (d: Date) => d.toISOString().slice(0, 10);

const AdminSupportChatMetrics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [from, setFrom] = useState(fmtDateInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(fmtDateInput(new Date()));
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map((r: any) => r.role);
      setIsAdmin(roles.includes("admin") || roles.includes("moderator"));
    })();
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();

      const [{ data: m, error: e1 }, { data: l, error: e2 }] = await Promise.all([
        supabase.rpc("get_support_chat_metrics" as any, { _from: fromIso, _to: toIso }),
        supabase
          .from("support_chat_logs" as any)
          .select("id, created_at, question, intent_category, status, http_status, response_time_ms, error_message, session_id")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setMetrics((m as unknown) as Metrics);
      setLogs((l ?? []) as unknown as LogRow[]);
    } catch (e: any) {
      toast({ title: "Erro ao carregar métricas", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [isAdmin]);

  const successRate = useMemo(() => {
    if (!metrics || !metrics.total_questions) return 0;
    return Math.round((metrics.answered / metrics.total_questions) * 100);
  }, [metrics]);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Métricas do Chatbot Ana
            </h1>
            <p className="text-sm text-muted-foreground">Perguntas respondidas, erros e intenções por categoria.</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">De</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Até</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
            </div>
            <Button onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>
        </div>

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

        {/* Daily volume */}
        <Card>
          <CardHeader><CardTitle className="text-base">Volume diário</CardTitle></CardHeader>
          <CardContent>
            {!metrics?.daily_volume?.length ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {metrics.daily_volume.map((d) => {
                  const max = Math.max(...metrics.daily_volume.map((x) => x.total)) || 1;
                  const h = Math.round((d.total / max) * 100);
                  const errH = d.total ? Math.round((d.errors / d.total) * h) : 0;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day} · ${d.total} perguntas · ${d.errors} erros`}>
                      <div className="w-full bg-muted rounded-sm relative" style={{ height: `${h}%`, minHeight: 4 }}>
                        <div className="absolute bottom-0 left-0 right-0 bg-destructive rounded-sm" style={{ height: `${errH}%` }} />
                        <div className="absolute inset-0 bg-primary/70 rounded-sm" style={{ height: `${100 - errH}%`, top: "auto", bottom: errH ? `${errH}%` : 0 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent logs */}
        <Card>
          <CardHeader><CardTitle className="text-base">Últimas 100 interações</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="py-2 pr-2">Quando</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Categoria</th>
                  <th className="py-2 pr-2">Tempo</th>
                  <th className="py-2 pr-2">Pergunta</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-border/40">
                    <td className="py-2 pr-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-2">
                      <Badge variant={l.status === "success" ? "secondary" : "destructive"}>
                        {l.status}{l.http_status ? ` · ${l.http_status}` : ""}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2 capitalize">{(l.intent_category || "-").replace(/_/g, " ")}</td>
                    <td className="py-2 pr-2 tabular-nums">{l.response_time_ms ?? "-"} ms</td>
                    <td className="py-2 pr-2 max-w-[420px] truncate" title={l.question ?? ""}>
                      {l.question || <span className="text-muted-foreground">—</span>}
                      {l.error_message && (
                        <span className="block text-xs text-destructive truncate">{l.error_message}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem interações no período.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
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
