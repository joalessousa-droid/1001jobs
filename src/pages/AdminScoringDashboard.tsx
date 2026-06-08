import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert, Star, User, Gem, Download } from "lucide-react";

type ScoreKind = "fraud" | "provider" | "client" | "all";

const toCSV = (rows: any[]) => {
  if (!rows.length) return "";
  const set = new Set<string>();
  rows.forEach(r => Object.keys(r).forEach(k => set.add(k)));
  const keys = Array.from(set);
  const esc = (v: any) => v == null ? "" : `"${(typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map(r => keys.map(k => esc((r as any)[k])).join(","))].join("\n");
};
const downloadCSV = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

type FraudRow = { profile_id: string; score: number; risk_level: string; auto_blocked: boolean; signals: any; last_evaluated_at: string };
type ProviderRow = { profile_id: string; score: number; tier: string; breakdown: any; last_evaluated_at: string };
type ClientRow = { profile_id: string; score: number; breakdown: any; last_evaluated_at: string };

const tierBadge = (t: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    diamond: { cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40", label: "Diamante" },
    gold:    { cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40", label: "Ouro" },
    silver:  { cls: "bg-slate-400/20 text-slate-200 border-slate-400/40", label: "Prata" },
    bronze:  { cls: "bg-amber-700/20 text-amber-300 border-amber-700/40", label: "Bronze" },
  };
  const m = map[t] || map.bronze;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};

const riskBadge = (lvl: string) => {
  if (lvl === "high") return <Badge variant="destructive">Alto</Badge>;
  if (lvl === "medium") return <Badge className="bg-yellow-600 hover:bg-yellow-600">Médio</Badge>;
  return <Badge variant="secondary">Baixo</Badge>;
};

export default function AdminScoringDashboard() {
  const [fraud, setFraud] = useState<FraudRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [recalcId, setRecalcId] = useState("");
  const [loading, setLoading] = useState(true);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportKind, setExportKind] = useState<ScoreKind>("all");

  const fetchForExport = async () => {
    const filter = (q: any) => {
      if (exportFrom) q = q.gte("last_evaluated_at", exportFrom);
      if (exportTo)   q = q.lte("last_evaluated_at", exportTo);
      return q;
    };
    const out: { fraud?: any[]; provider?: any[]; client?: any[]; events?: any[] } = {};
    if (exportKind === "all" || exportKind === "fraud") {
      const { data } = await filter(supabase.from("fraud_scores").select("*")).limit(5000);
      out.fraud = (data as any) || [];
    }
    if (exportKind === "all" || exportKind === "provider") {
      const { data } = await filter(supabase.from("provider_composite_scores").select("*")).limit(5000);
      out.provider = (data as any) || [];
    }
    if (exportKind === "all" || exportKind === "client") {
      const { data } = await filter(supabase.from("client_internal_scores").select("*")).limit(5000);
      out.client = (data as any) || [];
    }
    // Events from fraud audit log (covers fraud recalculations)
    let evq = supabase.from("fraud_audit_log").select("*");
    if (exportFrom) evq = evq.gte("created_at", exportFrom);
    if (exportTo) evq = evq.lte("created_at", exportTo);
    const { data: ev } = await evq.order("created_at", { ascending: false }).limit(5000);
    out.events = (ev as any) || [];
    return out;
  };

  const handleExport = async () => {
    try {
      const data = await fetchForExport();
      const stamp = new Date().toISOString().slice(0, 10);
      if (data.fraud?.length) downloadCSV(`scores-fraud-${stamp}.csv`, toCSV(data.fraud));
      if (data.provider?.length) downloadCSV(`scores-provider-${stamp}.csv`, toCSV(data.provider));
      if (data.client?.length) downloadCSV(`scores-client-${stamp}.csv`, toCSV(data.client));
      if (data.events?.length) downloadCSV(`scores-events-${stamp}.csv`, toCSV(data.events));
      toast.success("Exportação concluída.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao exportar.");
    }
  };

  const load = async () => {
    setLoading(true);
    const [f, p, c] = await Promise.all([
      supabase.from("fraud_scores").select("*").order("score", { ascending: false }).limit(100),
      supabase.from("provider_composite_scores").select("*").order("score", { ascending: false }).limit(100),
      supabase.from("client_internal_scores").select("*").order("score", { ascending: false }).limit(100),
    ]);
    setFraud((f.data as any) || []);
    setProviders((p.data as any) || []);
    setClients((c.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runRecalc = async (kind: "fraud" | "provider" | "client") => {
    if (!recalcId.trim()) return toast.error("Informe o profile_id");
    const rpc = kind === "fraud" ? "recalculate_fraud_score" : kind === "provider" ? "recalculate_provider_score" : "recalculate_client_score";
    const { error } = await supabase.rpc(rpc as any, { _profile_id: recalcId.trim() });
    if (error) toast.error(error.message);
    else { toast.success("Score recalculado."); load(); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel de Scores</h1>
        <p className="text-sm text-muted-foreground">Antifraude, reputação de prestadores e score interno de clientes.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recalcular score por profile_id</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input className="max-w-md" placeholder="profile_id (uuid)" value={recalcId} onChange={(e) => setRecalcId(e.target.value)} />
          <Button onClick={() => runRecalc("fraud")} variant="outline" size="sm"><ShieldAlert className="h-4 w-4 mr-1" />Antifraude</Button>
          <Button onClick={() => runRecalc("provider")} variant="outline" size="sm"><Gem className="h-4 w-4 mr-1" />Prestador</Button>
          <Button onClick={() => runRecalc("client")} variant="outline" size="sm"><User className="h-4 w-4 mr-1" />Cliente</Button>
          <Button onClick={load} variant="ghost" size="sm"><RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="fraud">
        <TabsList>
          <TabsTrigger value="fraud"><ShieldAlert className="h-4 w-4 mr-1" />Antifraude</TabsTrigger>
          <TabsTrigger value="providers"><Star className="h-4 w-4 mr-1" />Prestadores</TabsTrigger>
          <TabsTrigger value="clients"><User className="h-4 w-4 mr-1" />Clientes (interno)</TabsTrigger>
        </TabsList>

        <TabsContent value="fraud">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Profile</TableHead><TableHead>Score</TableHead><TableHead>Risco</TableHead>
                <TableHead>Auto-bloqueado</TableHead><TableHead>Sinais</TableHead><TableHead>Avaliado</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fraud.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados.</TableCell></TableRow>}
                {fraud.map((r) => (
                  <TableRow key={r.profile_id}>
                    <TableCell className="font-mono text-xs">{r.profile_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-semibold">{r.score}</TableCell>
                    <TableCell>{riskBadge(r.risk_level)}</TableCell>
                    <TableCell>{r.auto_blocked ? <Badge variant="destructive">Sim</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
                    <TableCell className="text-xs max-w-md truncate" title={JSON.stringify(r.signals)}>{JSON.stringify(r.signals)}</TableCell>
                    <TableCell className="text-xs">{new Date(r.last_evaluated_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="providers">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Profile</TableHead><TableHead>Score (0–1000)</TableHead><TableHead>Tier</TableHead>
                <TableHead>Avaliações</TableHead><TableHead>Pontualidade</TableHead><TableHead>Cancelamentos</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {providers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados.</TableCell></TableRow>}
                {providers.map((r) => (
                  <TableRow key={r.profile_id}>
                    <TableCell className="font-mono text-xs">{r.profile_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-semibold">{r.score}</TableCell>
                    <TableCell>{tierBadge(r.tier)}</TableCell>
                    <TableCell className="text-xs">{r.breakdown?.avg_rating ?? "—"} ({r.breakdown?.total_reviews ?? 0})</TableCell>
                    <TableCell className="text-xs">{((r.breakdown?.on_time_rate ?? 0) * 100).toFixed(0)}%</TableCell>
                    <TableCell className="text-xs">{r.breakdown?.cancellations ?? 0}/{r.breakdown?.total_services ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Profile</TableHead><TableHead>Score (0–1000)</TableHead>
                <TableHead>Pagamentos</TableHead><TableHead>Cancelamentos</TableHead>
                <TableHead>Denúncias</TableHead><TableHead>Avaliação recebida</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {clients.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados.</TableCell></TableRow>}
                {clients.map((r) => (
                  <TableRow key={r.profile_id}>
                    <TableCell className="font-mono text-xs">{r.profile_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-semibold">{r.score}</TableCell>
                    <TableCell className="text-xs">{r.breakdown?.payments_ok ?? 0} ok / {r.breakdown?.payment_failures ?? 0} falhas</TableCell>
                    <TableCell className="text-xs">{r.breakdown?.cancellations ?? 0}/{r.breakdown?.total_services ?? 0}</TableCell>
                    <TableCell className="text-xs">{r.breakdown?.reports ?? 0}</TableCell>
                    <TableCell className="text-xs">{Number(r.breakdown?.avg_received_rating ?? 0).toFixed(2)} ({r.breakdown?.reviews_received ?? 0})</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
