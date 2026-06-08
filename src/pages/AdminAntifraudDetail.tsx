import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, RefreshCw, ShieldAlert, Unlock, Download, Activity, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type FraudRow = {
  profile_id: string; score: number; risk_level: string;
  auto_blocked: boolean; signals: any; last_evaluated_at: string;
};
type AuditRow = {
  id: string; profile_id: string; triggered_by: string | null;
  trigger_source: string; score_before: number | null; score_after: number;
  risk_level: string; signals: any; auto_blocked: boolean;
  block_reason: string | null; notes: string | null; created_at: string;
};

const riskBadge = (lvl: string) => {
  if (lvl === "high") return <Badge variant="destructive">Alto</Badge>;
  if (lvl === "medium") return <Badge className="bg-yellow-600 hover:bg-yellow-600">Médio</Badge>;
  return <Badge variant="secondary">Baixo</Badge>;
};

const toCSV = (rows: any[]) => {
  if (!rows.length) return "";
  const set = new Set<string>();
  rows.forEach(r => Object.keys(r).forEach(k => set.add(k)));
  const keys = Array.from(set);
  const esc = (v: any) => v == null ? "" : `"${(typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/"/g,'""')}"`;
  return [keys.join(","), ...rows.map(r => keys.map(k => esc((r as any)[k])).join(","))].join("\n");
};
const dl = (name: string, csv: string) => {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

const PERIODS = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
  { id: "all", label: "Tudo", days: 9999 },
] as const;

const PAGE_SIZE = 20;
const TIMELINE_PAGE = 20;

// Compare two signal payloads and return a flat diff
function diffSignals(before: any, after: any) {
  const ba = (before?.contributions ?? before ?? {}) as Record<string, any>;
  const aa = (after?.contributions ?? after ?? {}) as Record<string, any>;
  const keys = new Set<string>([...Object.keys(ba), ...Object.keys(aa)]);
  const rows: { key: string; before: number; after: number; delta: number }[] = [];
  keys.forEach(k => {
    const b = Number(ba[k] ?? 0);
    const a = Number(aa[k] ?? 0);
    if (Number.isFinite(b) && Number.isFinite(a)) {
      rows.push({ key: k, before: b, after: a, delta: a - b });
    }
  });
  rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return rows;
}

export default function AdminAntifraudDetail() {
  const { profileId = "" } = useParams<{ profileId: string }>();
  const [fraud, setFraud] = useState<FraudRow | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<typeof PERIODS[number]["id"]>("30d");
  const [unblockReason, setUnblockReason] = useState("");
  const [onlyAuto, setOnlyAuto] = useState(false);
  const [timelineLimit, setTimelineLimit] = useState(TIMELINE_PAGE);
  const [tableLimit, setTableLimit] = useState(PAGE_SIZE);

  // Recalc diff dialog
  const [recalcing, setRecalcing] = useState(false);
  const [diff, setDiff] = useState<{
    before: FraudRow | null;
    after: FraudRow | null;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: f }, { data: a }] = await Promise.all([
      supabase.from("fraud_scores").select("*").eq("profile_id", profileId).maybeSingle(),
      supabase.from("fraud_audit_log").select("*").eq("profile_id", profileId)
        .order("created_at", { ascending: false }).limit(500),
    ]);
    setFraud((f as any) || null);
    setAudit((a as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (profileId) load(); /* eslint-disable-next-line */ }, [profileId]);

  // Realtime
  useEffect(() => {
    if (!profileId) return;
    const ch = supabase.channel(`fraud-audit-${profileId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "fraud_audit_log", filter: `profile_id=eq.${profileId}` },
        (p) => setAudit((cur) => [p.new as AuditRow, ...cur]))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "fraud_scores", filter: `profile_id=eq.${profileId}` },
        (p) => setFraud(p.new as FraudRow))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profileId]);

  const since = useMemo(() => {
    const days = PERIODS.find(p => p.id === period)!.days;
    return Date.now() - days * 86400_000;
  }, [period]);

  const filtered = useMemo(
    () => audit.filter(a => new Date(a.created_at).getTime() >= since),
    [audit, since],
  );

  const timelineRows = useMemo(() => {
    const base = onlyAuto
      ? filtered.filter(a => a.auto_blocked || a.trigger_source === "unblock")
      : filtered;
    return base;
  }, [filtered, onlyAuto]);

  const visibleTimeline = timelineRows.slice(0, timelineLimit);
  const visibleTable = filtered.slice(0, tableLimit);

  useEffect(() => { setTimelineLimit(TIMELINE_PAGE); }, [period, onlyAuto]);
  useEffect(() => { setTableLimit(PAGE_SIZE); }, [period]);

  const signalTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const a of filtered) {
      const s = (a.signals || {}) as Record<string, any>;
      for (const [k, v] of Object.entries(s)) {
        if (k === "contributions") continue;
        if (typeof v === "number") totals[k] = (totals[k] || 0) + v;
      }
    }
    return totals;
  }, [filtered]);

  const recalc = async () => {
    setRecalcing(true);
    try {
      // Snapshot "before"
      const { data: before } = await supabase
        .from("fraud_scores").select("*").eq("profile_id", profileId).maybeSingle();

      const { data: after, error } = await supabase
        .rpc("recalculate_fraud_score" as any, { _profile_id: profileId });
      if (error) throw error;

      setDiff({ before: (before as any) ?? null, after: (after as any) ?? null });
      if (after) setFraud(after as any);
      toast.success("Score recalculado.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao recalcular.");
    } finally {
      setRecalcing(false);
    }
  };

  const unblock = async () => {
    const { error } = await supabase.rpc("admin_unblock_profile" as any, {
      _profile_id: profileId, _reason: unblockReason || "manual unblock",
    });
    if (error) return toast.error(error.message);
    toast.success("Perfil desbloqueado.");
    setUnblockReason(""); load();
  };

  const exportCSV = () => dl(`antifraud-${profileId.slice(0,8)}-${period}.csv`, toCSV(filtered));

  if (loading) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const diffRows = diff ? diffSignals(diff.before?.signals, diff.after?.signals) : [];
  const beforeScore = diff?.before?.score ?? null;
  const afterScore = diff?.after?.score ?? null;
  const scoreDelta = (afterScore ?? 0) - (beforeScore ?? 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link to="/admin/antifraud" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Voltar para revisão
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
            <ShieldAlert className="h-6 w-6 text-destructive" /> Antifraude — detalhe do perfil
          </h1>
          <p className="text-xs font-mono text-muted-foreground break-all">{profileId}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button size="sm" onClick={recalc} disabled={recalcing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${recalcing ? "animate-spin" : ""}`} />
            Recalcular agora
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Score atual</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-6 items-center">
          {fraud ? (
            <>
              <div className="text-4xl font-bold">{fraud.score}</div>
              {riskBadge(fraud.risk_level)}
              {fraud.auto_blocked && <Badge variant="destructive">Auto-bloqueado</Badge>}
              <div className="text-xs text-muted-foreground">
                Última avaliação: {new Date(fraud.last_evaluated_at).toLocaleString("pt-BR")}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Sem score registrado para este perfil.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between flex">
          <CardTitle className="text-sm">Sinais agregados no período</CardTitle>
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <Button key={p.id} size="sm" variant={period === p.id ? "default" : "outline"} onClick={() => setPeriod(p.id)}>
                {p.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(signalTotals).length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum evento no período selecionado.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {Object.entries(signalTotals).map(([k, v]) => (
                <div key={k} className="rounded border p-2">
                  <div className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                  <div className="text-lg font-semibold">{v}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between flex gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />Timeline ({timelineRows.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch id="onlyauto" checked={onlyAuto} onCheckedChange={setOnlyAuto} />
            <Label htmlFor="onlyauto" className="text-xs">Apenas decisões automáticas</Label>
          </div>
        </CardHeader>
        <CardContent>
          {visibleTimeline.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum evento no período selecionado.</div>
          ) : (
            <>
              <div className="max-h-[420px] overflow-y-auto pr-2">
                <ol className="relative border-l border-border ml-2 space-y-3">
                  {visibleTimeline.map(a => {
                    const isAuto = a.auto_blocked || a.trigger_source === "unblock";
                    return (
                      <li key={a.id} className="ml-4 relative">
                        <div className={`absolute -left-[22px] top-1 w-3 h-3 rounded-full ${
                          a.auto_blocked ? "bg-destructive"
                            : a.trigger_source === "unblock" ? "bg-emerald-500"
                            : "bg-muted-foreground/40"}`} />
                        <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</div>
                        <div className="text-sm font-medium">
                          {a.auto_blocked ? "Bloqueio automático"
                            : a.trigger_source === "unblock" ? "Desbloqueio"
                            : "Recálculo"}
                          {isAuto && <Badge variant="outline" className="ml-2 text-[10px]">auto</Badge>}
                          <span className="ml-2">{riskBadge(a.risk_level)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            score {a.score_before ?? "—"} → {a.score_after}
                          </span>
                        </div>
                        {(a.block_reason || a.notes) && (
                          <div className="text-xs text-muted-foreground mt-1">{a.block_reason || a.notes}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
              {visibleTimeline.length < timelineRows.length && (
                <div className="text-center pt-3">
                  <Button size="sm" variant="outline" onClick={() => setTimelineLimit(l => l + TIMELINE_PAGE)}>
                    Carregar mais ({timelineRows.length - visibleTimeline.length} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de recálculos ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead><TableHead>Origem</TableHead>
                <TableHead>Δ Score</TableHead><TableHead>Risco</TableHead>
                <TableHead>Bloqueio</TableHead><TableHead>Sinais</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTable.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sem recálculos no período.</TableCell></TableRow>
              )}
              {visibleTable.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell><Badge variant="outline">{a.trigger_source}</Badge></TableCell>
                  <TableCell className="text-xs">{a.score_before ?? "—"} → {a.score_after}</TableCell>
                  <TableCell>{riskBadge(a.risk_level)}</TableCell>
                  <TableCell>{a.auto_blocked ? <Badge variant="destructive">Auto</Badge> : "—"}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate" title={JSON.stringify(a.signals)}>
                    {JSON.stringify(a.signals)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleTable.length < filtered.length && (
            <div className="text-center py-3">
              <Button size="sm" variant="outline" onClick={() => setTableLimit(l => l + PAGE_SIZE)}>
                Carregar mais ({filtered.length - visibleTable.length} restantes)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {fraud?.auto_blocked && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Unlock className="h-4 w-4" />Desbloquear perfil</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea placeholder="Motivo do desbloqueio (auditado)" value={unblockReason} onChange={e => setUnblockReason(e.target.value)} />
            <Button onClick={unblock} variant="destructive"><Unlock className="h-4 w-4 mr-1" />Confirmar desbloqueio</Button>
          </CardContent>
        </Card>
      )}

      {/* Before/after diff dialog */}
      <Dialog open={!!diff} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recálculo manual — antes × depois</DialogTitle>
          </DialogHeader>
          {diff && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Score anterior</div>
                  <div className="text-2xl font-bold">{beforeScore ?? "—"}</div>
                  {diff.before && <div className="mt-1">{riskBadge(diff.before.risk_level)}</div>}
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Score atual</div>
                  <div className="text-2xl font-bold">{afterScore ?? "—"}</div>
                  {diff.after && <div className="mt-1">{riskBadge(diff.after.risk_level)}</div>}
                </div>
              </div>

              <div className="text-center text-sm">
                Variação:{" "}
                <span className={scoreDelta > 0 ? "text-destructive font-semibold" : scoreDelta < 0 ? "text-emerald-500 font-semibold" : ""}>
                  {scoreDelta > 0 ? "+" : ""}{scoreDelta}
                </span>
                {diff.after?.auto_blocked && <Badge variant="destructive" className="ml-2">Auto-bloqueio aplicado</Badge>}
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Contribuição por sinal</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Sinal</TableHead><TableHead className="text-right">Antes</TableHead>
                      <TableHead className="text-right">Depois</TableHead><TableHead className="text-right">Δ</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {diffRows.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-3">Sem dados comparáveis.</TableCell></TableRow>
                      )}
                      {diffRows.map(r => (
                        <TableRow key={r.key}>
                          <TableCell className="text-xs capitalize">{r.key.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-right text-xs">{r.before}</TableCell>
                          <TableCell className="text-right text-xs">{r.after}</TableCell>
                          <TableCell className={`text-right text-xs font-medium ${r.delta > 0 ? "text-destructive" : r.delta < 0 ? "text-emerald-500" : ""}`}>
                            {r.delta > 0 ? "+" : ""}{r.delta}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiff(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
