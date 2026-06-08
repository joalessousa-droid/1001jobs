import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, AlertCircle, CheckCircle2, Clock, Search } from "lucide-react";
import { format } from "date-fns";

// --- minimal cron next-runs (UTC) ---
function parseField(expr: string, min: number, max: number): number[] {
  const out = new Set<number>();
  expr.split(",").forEach((part) => {
    let step = 1; let range = part;
    if (part.includes("/")) { const [r, s] = part.split("/"); range = r; step = parseInt(s, 10) || 1; }
    let start = min, end = max;
    if (range === "*" || range === "") {} else if (range.includes("-")) {
      const [a, b] = range.split("-").map((n) => parseInt(n, 10)); start = a; end = b;
    } else { start = parseInt(range, 10); end = start; }
    for (let v = start; v <= end; v += step) if (v >= min && v <= max) out.add(v);
  });
  return Array.from(out).sort((a, b) => a - b);
}
function nextRuns(cron: string, from: Date, count = 5): Date[] {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return [];
    const mins = parseField(parts[0], 0, 59), hrs = parseField(parts[1], 0, 23);
    const doms = parseField(parts[2], 1, 31), mons = parseField(parts[3], 1, 12);
    const dows = parseField(parts[4], 0, 6);
    const out: Date[] = [];
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), from.getUTCHours(), from.getUTCMinutes() + 1));
    let i = 0; const max = 60 * 24 * 366;
    while (out.length < count && i++ < max) {
      if (mins.includes(d.getUTCMinutes()) && hrs.includes(d.getUTCHours()) && doms.includes(d.getUTCDate())
          && mons.includes(d.getUTCMonth() + 1) && dows.includes(d.getUTCDay())) out.push(new Date(d));
      d.setUTCMinutes(d.getUTCMinutes() + 1);
    }
    return out;
  } catch { return []; }
}

type JobStatus = {
  jobid: number; jobname: string | null; schedule: string; active: boolean;
  last_start: string | null; last_end: string | null; last_status: string | null; last_return_message: string | null;
};
type RunDetail = {
  runid: number; jobid: number; start_time: string | null; end_time: string | null;
  status: string | null; return_message: string | null;
};
type RunFull = RunDetail & { jobname?: string | null; schedule?: string | null; command?: string | null; database?: string | null; username?: string | null };

const fmt = (iso: string | null | undefined) => (iso ? format(new Date(iso), "yyyy-MM-dd HH:mm:ss") : "—");

const StatusBadge = ({ s }: { s: string | null }) => {
  const v = (s || "").toLowerCase();
  if (v === "succeeded") return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Sucesso</Badge>;
  if (v === "failed") return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Falha</Badge>;
  if (v === "running") return <Badge className="gap-1"><Clock className="h-3 w-3" />Em execução</Badge>;
  return <Badge variant="outline">{s || "—"}</Badge>;
};

export default function AdminScheduledJobs() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [runs, setRuns] = useState<Record<number, RunDetail[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  // filters
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // run detail
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<RunFull | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.rpc("get_scheduled_jobs_status" as any);
    if (error) { setError(error.message); setJobs([]); }
    else {
      const list = (data || []) as JobStatus[];
      setJobs(list);
      if (list.length && selected == null) setSelected(list[0].jobid);
    }
    setLoading(false);
  }, [selected]);

  const loadRuns = useCallback(async (jobid: number) => {
    const { data, error } = await supabase.rpc("get_scheduled_job_runs" as any, { _jobid: jobid, _limit: 200 });
    if (!error) setRuns((prev) => ({ ...prev, [jobid]: (data || []) as RunDetail[] }));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selected != null) loadRuns(selected); }, [selected, loadRuns]);

  const filteredJobs = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    return jobs.filter((j) => {
      if (q && !(j.jobname || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, nameFilter]);

  const selectedJob = jobs.find((j) => j.jobid === selected) || null;
  const allSelectedRuns = selected != null ? runs[selected] || [] : [];

  const filteredRuns = useMemo(() => {
    const s = startDate ? new Date(startDate + "T00:00:00Z").getTime() : null;
    const e = endDate ? new Date(endDate + "T23:59:59Z").getTime() : null;
    return allSelectedRuns.filter((r) => {
      if (statusFilter !== "all" && (r.status || "").toLowerCase() !== statusFilter) return false;
      if (r.start_time) {
        const t = new Date(r.start_time).getTime();
        if (s && t < s) return false;
        if (e && t > e) return false;
      }
      return true;
    });
  }, [allSelectedRuns, statusFilter, startDate, endDate]);

  const recentFailures = filteredRuns.filter((r) => (r.status || "").toLowerCase() === "failed").slice(0, 10);
  const upcoming = selectedJob ? nextRuns(selectedJob.schedule, new Date(), 5) : [];

  const openRunDetail = async (runid: number) => {
    setDetailOpen(true); setDetail(null); setDetailLoading(true);
    const { data, error } = await supabase.rpc("get_scheduled_job_run_detail" as any, { _runid: runid });
    setDetailLoading(false);
    if (!error && data && (data as any[]).length) setDetail((data as any[])[0] as RunFull);
  };

  const clearFilters = () => { setNameFilter(""); setStatusFilter("all"); setStartDate(""); setEndDate(""); };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs Agendados</h1>
          <p className="text-sm text-muted-foreground">Monitoramento de execuções, agendamentos e falhas (UTC).</p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label className="text-xs">Nome do job</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="ex: cron-job-monitor" className="pl-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="succeeded">Sucesso</SelectItem>
                  <SelectItem value="failed">Falha</SelectItem>
                  <SelectItem value="running">Em execução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Jobs configurados ({filteredJobs.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Última execução</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum job encontrado.</TableCell></TableRow>
              )}
              {filteredJobs.map((j) => (
                <TableRow key={j.jobid} className={selected === j.jobid ? "bg-muted/40" : ""}>
                  <TableCell className="font-medium">{j.jobname || `job_${j.jobid}`}</TableCell>
                  <TableCell><code className="text-xs">{j.schedule}</code></TableCell>
                  <TableCell>{j.active ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Pausado</Badge>}</TableCell>
                  <TableCell className="text-xs">{fmt(j.last_start)}</TableCell>
                  <TableCell><StatusBadge s={j.last_status} /></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => setSelected(j.jobid)}>Detalhes</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedJob && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Próximos agendamentos</CardTitle></CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Não foi possível calcular a partir do schedule.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {upcoming.map((d, i) => (
                    <li key={i} className="flex justify-between border-b pb-1">
                      <span>#{i + 1}</span>
                      <span className="font-mono">{format(d, "yyyy-MM-dd HH:mm")} UTC</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Falhas recentes ({recentFailures.length})</CardTitle></CardHeader>
            <CardContent>
              {recentFailures.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem falhas no filtro atual.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {recentFailures.map((r) => (
                    <li key={r.runid} className="border-b pb-2 cursor-pointer hover:bg-muted/30 rounded px-1" onClick={() => openRunDetail(r.runid)}>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{fmt(r.start_time)}</span>
                        <StatusBadge s={r.status} />
                      </div>
                      <div className="text-xs truncate" title={r.return_message || ""}>{r.return_message || "—"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Logs ({filteredRuns.length} de {allSelectedRuns.length} execuções)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRuns.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem execuções no filtro atual.</TableCell></TableRow>
                  )}
                  {filteredRuns.map((r) => (
                    <TableRow key={r.runid} className="cursor-pointer hover:bg-muted/30" onClick={() => openRunDetail(r.runid)}>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(r.start_time)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(r.end_time)}</TableCell>
                      <TableCell><StatusBadge s={r.status} /></TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={r.return_message || ""}>{r.return_message || "—"}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openRunDetail(r.runid); }}>Ver</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Detalhe da execução</DialogTitle></DialogHeader>
          {detailLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!detailLoading && !detail && <p className="text-sm text-muted-foreground">Execução não encontrada.</p>}
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Run ID</Label><div className="font-mono">{detail.runid}</div></div>
                <div><Label className="text-xs">Job</Label><div className="font-mono">{detail.jobname || `job_${detail.jobid}`}</div></div>
                <div><Label className="text-xs">Schedule</Label><div><code className="text-xs">{detail.schedule}</code></div></div>
                <div><Label className="text-xs">Status</Label><div><StatusBadge s={detail.status} /></div></div>
                <div><Label className="text-xs">Início</Label><div>{fmt(detail.start_time)}</div></div>
                <div><Label className="text-xs">Fim</Label><div>{fmt(detail.end_time)}</div></div>
                <div><Label className="text-xs">Database</Label><div>{detail.database || "—"}</div></div>
                <div><Label className="text-xs">Usuário</Label><div>{detail.username || "—"}</div></div>
              </div>
              <div>
                <Label className="text-xs">Payload / Comando</Label>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">{detail.command || "—"}</pre>
              </div>
              <div>
                <Label className="text-xs">Logs completos</Label>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">{detail.return_message || "—"}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
