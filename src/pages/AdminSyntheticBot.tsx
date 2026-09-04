// Auditoria do bot sintético: histórico de runs, métricas de renovação e expiração manual.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2, Bot, Rocket, Users } from "lucide-react";

type Row = {
  id: string;
  run_at: string;
  action: string;
  profiles_created: number;
  requests_created: number;
  profiles_expired: number;
  requests_expired: number;
  active_profiles: number;
  active_requests: number;
  notes: string | null;
};

export default function AdminSyntheticBot() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "profiles" | "requests">("all");
  const [limit, setLimit] = useState(50);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ profiles: 0, requests: 0 });
  const [taskCount, setTaskCount] = useState(1000);
  const [targetProfiles, setTargetProfiles] = useState(2000);
  const [targetRequests, setTargetRequests] = useState(5000);

  async function load() {
    setLoading(true);
    const [{ data }, { count: pc }, { count: rc }] = await Promise.all([
      supabase.from("synthetic_bot_state").select("*").order("run_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_synthetic", true),
      supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("is_synthetic", true),
    ]);
    setRows((data as Row[]) ?? []);
    setCounts({ profiles: pc ?? 0, requests: rc ?? 0 });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      r.action.toLowerCase().includes(s) || (r.notes ?? "").toLowerCase().includes(s) || r.id.includes(s)
    );
  }, [rows, q]);

  const totals = useMemo(() => {
    const last24 = Date.now() - 86_400_000;
    const recent = rows.filter((r) => new Date(r.run_at).getTime() >= last24);
    return {
      runs24h: recent.length,
      created24h: recent.reduce((a, r) => a + r.profiles_created + r.requests_created, 0),
      expired24h: recent.reduce((a, r) => a + r.profiles_expired + r.requests_expired, 0),
    };
  }, [rows]);

  async function runBot() {
    setBusy(true);
    const { error } = await supabase.functions.invoke("synthetic-seed-bot", { body: {} });
    setBusy(false);
    if (error) toast.error("Falha ao executar o bot"); else { toast.success("Bot executado"); load(); }
  }

  // Gera um volume de tarefas de engajamento (em blocos de até 3.000 por chamada).
  async function generateTasks() {
    setBusy(true);
    let remaining = Math.max(1, Math.min(50000, taskCount));
    let total = 0;
    while (remaining > 0) {
      const chunk = Math.min(3000, remaining);
      const { data, error } = await supabase.functions.invoke("synthetic-seed-bot", {
        body: { mode: "tasks", count: chunk },
      });
      if (error) { toast.error("Falha ao gerar tarefas"); break; }
      const made = Number((data as any)?.requestsCreated ?? 0);
      total += made;
      remaining -= chunk;
      if (!made) break;
    }
    setBusy(false);
    if (total) toast.success(`${total.toLocaleString("pt-BR")} tarefas criadas`);
    load();
  }

  // Repõe perfis e tarefas até os alvos informados.
  async function fillTargets() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("synthetic-seed-bot", {
      body: { mode: "fill", targetProfiles, targetRequests, batch: 200 },
    });
    setBusy(false);
    if (error) { toast.error("Falha ao repor bots"); return; }
    const r = data as any;
    toast.success(`+${r?.profilesCreated ?? 0} bots, +${r?.requestsCreated ?? 0} tarefas`);
    load();
  }

  async function expireBatch() {
    setBusy(true);
    const { data, error } = await supabase.rpc("expire_synthetic_batch", { _scope: scope, _limit: limit });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    toast.success(`Expirados: ${r?.profiles_expired ?? 0} perfis, ${r?.requests_expired ?? 0} tarefas`);
    load();
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Bot Sintético — Auditoria</h1>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Perfis ativos" value={counts.profiles} />
        <Metric label="Tarefas ativas" value={counts.requests} />
        <Metric label="Runs (24h)" value={totals.runs24h} />
        <Metric label="Criados (24h)" value={totals.created24h} />
        <Metric label="Expirados (24h)" value={totals.expired24h} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Fábrica de engajamento (somente admin)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tarefas a gerar agora</label>
            <Input type="number" min={1} max={50000} value={taskCount}
              onChange={(e) => setTaskCount(Number(e.target.value) || 1)} className="w-32"
              data-testid="bot-task-count" />
          </div>
          <Button onClick={generateTasks} disabled={busy} data-testid="bot-generate-tasks">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            Gerar tarefas
          </Button>
          <div className="h-8 w-px bg-border hidden md:block" />
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Alvo de bots</label>
            <Input type="number" min={0} max={20000} value={targetProfiles}
              onChange={(e) => setTargetProfiles(Number(e.target.value) || 0)} className="w-32"
              data-testid="bot-target-profiles" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Alvo de tarefas ativas</label>
            <Input type="number" min={0} max={20000} value={targetRequests}
              onChange={(e) => setTargetRequests(Number(e.target.value) || 0)} className="w-32"
              data-testid="bot-target-requests" />
          </div>
          <Button variant="secondary" onClick={fillTargets} disabled={busy} data-testid="bot-fill-targets">
            <Users className="h-4 w-4 mr-2" /> Repor até o alvo
          </Button>
          <p className="text-xs text-muted-foreground w-full">
            Cada execução cria até 3.000 registros; volumes maiores são divididos automaticamente.
            Tudo é marcado como sintético e expira em 30 dias.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ações manuais</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <Button onClick={runBot} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Executar bot agora
          </Button>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Escopo</label>
              <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Perfis + Tarefas</SelectItem>
                  <SelectItem value="profiles">Somente perfis</SelectItem>
                  <SelectItem value="requests">Somente tarefas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Limite</label>
              <Input type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 1)} className="w-24" />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  <Trash2 className="h-4 w-4 mr-2" /> Expirar lote manual
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar expiração manual</AlertDialogTitle>
                  <AlertDialogDescription>
                    Serão removidos até {limit} registros sintéticos (escopo: <b>{scope}</b>) mais próximos do vencimento. Esta ação é irreversível.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={expireBatch}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Histórico de execuções</span>
            <Input placeholder="Buscar por ação, notas ou id..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="text-right">Perfis +</TableHead>
                  <TableHead className="text-right">Tarefas +</TableHead>
                  <TableHead className="text-right">Perfis -</TableHead>
                  <TableHead className="text-right">Tarefas -</TableHead>
                  <TableHead className="text-right">Ativos P/T</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.run_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant={r.action === "manual_expire" ? "destructive" : "secondary"}>{r.action}</Badge></TableCell>
                    <TableCell className="text-right text-emerald-600">+{r.profiles_created}</TableCell>
                    <TableCell className="text-right text-emerald-600">+{r.requests_created}</TableCell>
                    <TableCell className="text-right text-rose-600">-{r.profiles_expired}</TableCell>
                    <TableCell className="text-right text-rose-600">-{r.requests_expired}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{r.active_profiles}/{r.active_requests}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.notes}</TableCell>
                  </TableRow>
                ))}
                {!filtered.length && !loading && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhum registro encontrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</div>
      </CardContent>
    </Card>
  );
}
