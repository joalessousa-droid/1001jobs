import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert, Star, User, Gem } from "lucide-react";

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
