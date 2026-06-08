import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, RefreshCw, Unlock, FileSearch, Download } from "lucide-react";
import { toast } from "sonner";

type FraudRow = {
  profile_id: string;
  score: number;
  risk_level: string;
  auto_blocked: boolean;
  signals: any;
  last_evaluated_at: string;
};
type AuditRow = {
  id: string;
  profile_id: string;
  triggered_by: string | null;
  trigger_source: string;
  score_before: number | null;
  score_after: number;
  risk_level: string;
  signals: any;
  auto_blocked: boolean;
  block_reason: string | null;
  notes: string | null;
  created_at: string;
};

const riskBadge = (lvl: string) => {
  if (lvl === "high") return <Badge variant="destructive">Alto</Badge>;
  if (lvl === "medium") return <Badge className="bg-yellow-600 hover:bg-yellow-600">Médio</Badge>;
  return <Badge variant="secondary">Baixo</Badge>;
};

const toCSV = (rows: any[]) => {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [keys.join(","), ...rows.map(r => keys.map(k => esc(r[k])).join(","))].join("\n");
};

const downloadCSV = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function AdminAntifraud() {
  const [rows, setRows] = useState<FraudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low">("high");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<FraudRow | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [unblockReason, setUnblockReason] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("fraud_scores").select("*").order("score", { ascending: false }).limit(500);
    if (riskFilter !== "all") q = q.eq("risk_level", riskFilter);
    const { data } = await q;
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [riskFilter]);

  const filtered = useMemo(
    () => rows.filter(r => !search || r.profile_id.includes(search.trim())),
    [rows, search],
  );

  const openDetail = async (row: FraudRow) => {
    setDetail(row);
    const { data } = await supabase
      .from("fraud_audit_log")
      .select("*").eq("profile_id", row.profile_id)
      .order("created_at", { ascending: false }).limit(50);
    setAudit((data as any) || []);
  };

  const recalc = async (id: string) => {
    const { error } = await supabase.rpc("recalculate_fraud_score" as any, { _profile_id: id });
    if (error) return toast.error(error.message);
    toast.success("Score recalculado.");
    load();
    if (detail?.profile_id === id) openDetail(detail);
  };

  const unblock = async () => {
    if (!detail) return;
    const { error } = await supabase.rpc("admin_unblock_profile" as any, {
      _profile_id: detail.profile_id,
      _reason: unblockReason || "manual unblock",
    });
    if (error) return toast.error(error.message);
    toast.success("Perfil desbloqueado.");
    setUnblockReason("");
    load();
    openDetail(detail);
  };

  const exportCSV = () => {
    const csv = toCSV(filtered.map(r => ({
      profile_id: r.profile_id, score: r.score, risk_level: r.risk_level,
      auto_blocked: r.auto_blocked, last_evaluated_at: r.last_evaluated_at,
      signals: r.signals,
    })));
    downloadCSV(`antifraude-${new Date().toISOString().slice(0,10)}.csv`, csv);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" /> Revisão antifraude
          </h1>
          <p className="text-sm text-muted-foreground">Perfis com risco identificado — revise sinais e desbloqueie se necessário.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          {(["all","high","medium","low"] as const).map(l => (
            <Button key={l} size="sm" variant={riskFilter === l ? "default" : "outline"} onClick={() => setRiskFilter(l)}>
              {l === "all" ? "Todos" : l === "high" ? "Alto" : l === "medium" ? "Médio" : "Baixo"}
            </Button>
          ))}
          <Input className="max-w-sm" placeholder="Buscar por profile_id" value={search} onChange={e => setSearch(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Bloqueado</TableHead>
                <TableHead>Avaliado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum perfil encontrado.</TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.profile_id}>
                  <TableCell className="font-mono text-xs">{r.profile_id.slice(0,8)}…</TableCell>
                  <TableCell className="font-semibold">{r.score}</TableCell>
                  <TableCell>{riskBadge(r.risk_level)}</TableCell>
                  <TableCell>{r.auto_blocked ? <Badge variant="destructive">Auto</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.last_evaluated_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openDetail(r)} title="Visão rápida"><FileSearch className="h-4 w-4" /></Button>
                    <a href={`/admin/antifraud/${r.profile_id}`} className="inline-flex items-center text-xs text-primary hover:underline px-2">abrir</a>
                    <Button size="sm" variant="outline" onClick={() => recalc(r.profile_id)}><RefreshCw className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do perfil</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Profile:</span> <span className="font-mono">{detail.profile_id}</span></div>
                <div><span className="text-muted-foreground">Score:</span> <strong>{detail.score}</strong> {riskBadge(detail.risk_level)}</div>
                <div><span className="text-muted-foreground">Auto-bloqueado:</span> {detail.auto_blocked ? "Sim" : "Não"}</div>
                <div><span className="text-muted-foreground">Avaliado:</span> {new Date(detail.last_evaluated_at).toLocaleString("pt-BR")}</div>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Sinais</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{JSON.stringify(detail.signals, null, 2)}</pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Trilha de auditoria</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quando</TableHead><TableHead>Origem</TableHead>
                        <TableHead>Δ</TableHead><TableHead>Risco</TableHead>
                        <TableHead>Bloqueio</TableHead><TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem eventos.</TableCell></TableRow>
                      )}
                      {audit.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell><Badge variant="outline">{a.trigger_source}</Badge></TableCell>
                          <TableCell className="text-xs">{a.score_before ?? "—"} → {a.score_after}</TableCell>
                          <TableCell>{riskBadge(a.risk_level)}</TableCell>
                          <TableCell>{a.auto_blocked ? <Badge variant="destructive">Auto</Badge> : "—"}</TableCell>
                          <TableCell className="text-xs max-w-[280px] truncate" title={a.block_reason || a.notes || ""}>{a.block_reason || a.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {detail.auto_blocked && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Unlock className="h-4 w-4" />Desbloquear perfil</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea placeholder="Motivo do desbloqueio (auditado)" value={unblockReason} onChange={e => setUnblockReason(e.target.value)} />
                    <Button onClick={unblock} variant="destructive"><Unlock className="h-4 w-4 mr-1" />Confirmar desbloqueio</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => detail && recalc(detail.profile_id)}><RefreshCw className="h-4 w-4 mr-1" />Recalcular score</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
