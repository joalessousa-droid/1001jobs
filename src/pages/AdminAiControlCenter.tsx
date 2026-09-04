import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";

interface Metrics {
  predictions: number;
  outcomes: number;
  diagnosis_accuracy: number | null;
  price_mape: number | null;
  price_bias: number | null;
  price_mae: number | null;
  price_median_error: number | null;
  duration_mape: number | null;
  avg_confidence: number | null;
  cancel_rate: number | null;
  rework_rate: number | null;
  satisfaction: number | null;
  open_anomalies: number;
  pending_changes: number;
  error_by_category: { category: string; n: number; bias: number }[];
  error_by_region: { region: string; n: number; bias: number }[];
}

interface Anomaly {
  id: string;
  kind: string;
  severity: string;
  category: string | null;
  scope_value: string | null;
  subject_id: string | null;
  details: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface ChangeRequest {
  id: string;
  kind: string;
  target_key: string | null;
  proposed_value: Record<string, unknown>;
  rationale: string | null;
  status: string;
  created_at: string;
}

const pct = (v: number | null | undefined, suffix = "%") =>
  v == null ? "—" : `${v}${suffix}`;

/** 34/12/33/36 — 1001 AI CONTROL CENTER */
const AdminAiControlCenter = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [models, setModels] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, a, c, mv] = await Promise.all([
      supabase.rpc("ai_control_center", { _days: 30 }),
      supabase
        .from("ai_anomalies")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ai_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("ai_model_comparison", { _days: 90 }),
    ]);
    if (m.data) setMetrics(m.data as unknown as Metrics);
    if (a.data) setAnomalies(a.data as unknown as Anomaly[]);
    if (c.data) setChanges(c.data as unknown as ChangeRequest[]);
    if (mv.data) setModels(mv.data as unknown as Record<string, unknown>[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runLearning = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("ai-learning-cycle", { body: {} });
      if (error) throw error;
      toast.success("Ciclo de aprendizado executado.");
      await load();
    } catch {
      toast.error("Não foi possível executar o ciclo agora.");
    } finally {
      setRunning(false);
    }
  };

  const reviewAnomaly = async (id: string, status: "reviewed" | "dismissed") => {
    await supabase.from("ai_anomalies").update({ status }).eq("id", id);
    setAnomalies((prev) => prev.filter((a) => a.id !== id));
  };

  const decideChange = async (id: string, status: "approved" | "rejected") => {
    await supabase
      .from("ai_change_requests")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setChanges((prev) => prev.filter((c) => c.id !== id));
    toast.success(status === "approved" ? "Alteração aprovada." : "Alteração rejeitada.");
  };

  const cards = [
    { label: "Precisão do diagnóstico", value: pct(metrics?.diagnosis_accuracy ?? null) },
    { label: "Erro médio de preço (MAPE)", value: pct(metrics?.price_mape ?? null) },
    { label: "Viés de preço", value: pct(metrics?.price_bias ?? null) },
    { label: "Erro mediano", value: pct(metrics?.price_median_error ?? null) },
    { label: "Erro de duração", value: pct(metrics?.duration_mape ?? null) },
    { label: "Confiança média da IA", value: pct(metrics?.avg_confidence ?? null) },
    { label: "Cancelamento", value: pct(metrics?.cancel_rate ?? null) },
    { label: "Retrabalho", value: pct(metrics?.rework_rate ?? null) },
    { label: "Satisfação", value: metrics?.satisfaction != null ? String(metrics.satisfaction) : "—" },
    { label: "Previsões (30d)", value: String(metrics?.predictions ?? 0) },
    { label: "Resultados registrados", value: String(metrics?.outcomes ?? 0) },
    { label: "Anomalias abertas", value: String(metrics?.open_anomalies ?? 0) },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6" /> 1001 AI Control Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Precisão, aprendizado e correções da inteligência da plataforma.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading} data-testid="ai-cc-reload">
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button onClick={runLearning} disabled={running} data-testid="ai-cc-run">
              Executar ciclo de aprendizado
            </Button>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="ai-cc-metrics">
          {cards.map((c) => (
            <Card key={c.label} className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-semibold">{c.value}</p>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="errors">
          <TabsList>
            <TabsTrigger value="errors">Erros</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalias</TabsTrigger>
            <TabsTrigger value="changes">Aprovações</TabsTrigger>
            <TabsTrigger value="models">Modelos A/B</TabsTrigger>
          </TabsList>

          <TabsContent value="errors" className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-medium mb-3">Erro por categoria</h2>
              {(metrics?.error_by_category ?? []).map((e) => (
                <div key={e.category} className="flex justify-between text-sm py-1 border-b border-border/40">
                  <span>{e.category ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {e.bias > 0 ? "+" : ""}
                    {e.bias}% · {e.n} obs.
                  </span>
                </div>
              ))}
              {!metrics?.error_by_category?.length && (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              )}
            </Card>
            <Card className="p-4">
              <h2 className="font-medium mb-3">Erro por região</h2>
              {(metrics?.error_by_region ?? []).map((e) => (
                <div key={e.region} className="flex justify-between text-sm py-1 border-b border-border/40">
                  <span>{e.region ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {e.bias > 0 ? "+" : ""}
                    {e.bias}% · {e.n} obs.
                  </span>
                </div>
              ))}
              {!metrics?.error_by_region?.length && (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-3">
            {anomalies.map((a) => (
              <Card key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {a.kind}
                    <Badge variant={a.severity === "high" ? "destructive" : "secondary"}>{a.severity}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.category ?? a.subject_id ?? "—"} {a.scope_value ? `· ${a.scope_value}` : ""} ·{" "}
                    {JSON.stringify(a.details)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => reviewAnomaly(a.id, "dismissed")}>
                    Descartar
                  </Button>
                  <Button size="sm" onClick={() => reviewAnomaly(a.id, "reviewed")}>
                    Marcar revisada
                  </Button>
                </div>
              </Card>
            ))}
            {!anomalies.length && <p className="text-sm text-muted-foreground">Nenhuma anomalia aberta.</p>}
          </TabsContent>

          <TabsContent value="changes" className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Alterações acima do limite automático exigem aprovação humana.
            </p>
            {changes.map((c) => (
              <Card key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {c.kind} · {c.target_key}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.rationale}</p>
                  <p className="text-xs text-muted-foreground">{JSON.stringify(c.proposed_value)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => decideChange(c.id, "rejected")}>
                    Rejeitar
                  </Button>
                  <Button size="sm" onClick={() => decideChange(c.id, "approved")}>
                    Aprovar
                  </Button>
                </div>
              </Card>
            ))}
            {!changes.length && <p className="text-sm text-muted-foreground">Nenhuma aprovação pendente.</p>}
          </TabsContent>

          <TabsContent value="models">
            <Card className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">Versão</th>
                    <th>Grupo</th>
                    <th>Previsões</th>
                    <th>MAPE preço</th>
                    <th>Viés</th>
                    <th>Diagnóstico</th>
                    <th>Satisfação</th>
                    <th>Cancelamento</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-2">{String(m.model_version ?? "—")}</td>
                      <td>{String(m.ab_group ?? "—")}</td>
                      <td>{String(m.predictions ?? 0)}</td>
                      <td>{m.price_mape == null ? "—" : `${m.price_mape}%`}</td>
                      <td>{m.price_bias == null ? "—" : `${m.price_bias}%`}</td>
                      <td>{m.diagnosis_accuracy == null ? "—" : `${m.diagnosis_accuracy}%`}</td>
                      <td>{String(m.satisfaction ?? "—")}</td>
                      <td>{m.cancel_rate == null ? "—" : `${m.cancel_rate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!models.length && <p className="text-sm text-muted-foreground">Sem previsões registradas ainda.</p>}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminAiControlCenter;
