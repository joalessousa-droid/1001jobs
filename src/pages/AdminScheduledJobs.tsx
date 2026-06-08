import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

// Lightweight cron parser → next N runs (UTC). Supports basic m h dom mon dow with *, */n, lists, ranges.
function parseField(expr: string, min: number, max: number): number[] {
  const out = new Set<number>();
  expr.split(",").forEach((part) => {
    let step = 1;
    let range = part;
    if (part.includes("/")) {
      const [r, s] = part.split("/");
      range = r;
      step = parseInt(s, 10) || 1;
    }
    let start = min;
    let end = max;
    if (range === "*" || range === "") {
      // keep defaults
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map((n) => parseInt(n, 10));
      start = a;
      end = b;
    } else {
      start = parseInt(range, 10);
      end = start;
    }
    for (let v = start; v <= end; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
  });
  return Array.from(out).sort((a, b) => a - b);
}

function nextRuns(cron: string, from: Date, count = 5): Date[] {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return [];
    const mins = parseField(parts[0], 0, 59);
    const hrs = parseField(parts[1], 0, 23);
    const doms = parseField(parts[2], 1, 31);
    const mons = parseField(parts[3], 1, 12);
    const dows = parseField(parts[4], 0, 6);
    const out: Date[] = [];
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), from.getUTCHours(), from.getUTCMinutes() + 1, 0, 0));
    const maxIter = 60 * 24 * 366;
    let i = 0;
    while (out.length < count && i++ < maxIter) {
      if (
        mins.includes(d.getUTCMinutes()) &&
        hrs.includes(d.getUTCHours()) &&
        doms.includes(d.getUTCDate()) &&
        mons.includes(d.getUTCMonth() + 1) &&
        dows.includes(d.getUTCDay())
      ) {
        out.push(new Date(d));
      }
      d.setUTCMinutes(d.getUTCMinutes() + 1);
    }
    return out;
  } catch {
    return [];
  }
}

type JobStatus = {
  jobid: number;
  jobname: string | null;
  schedule: string;
  active: boolean;
  last_start: string | null;
  last_end: string | null;
  last_status: string | null;
  last_return_message: string | null;
};

type RunDetail = {
  runid: number;
  jobid: number;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  return_message: string | null;
};

const fmt = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd HH:mm:ss") : "—");

export default function AdminScheduledJobs() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [runs, setRuns] = useState<Record<number, RunDetail[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_scheduled_jobs_status" as any);
    if (error) {
      setError(error.message);
      setJobs([]);
    } else {
      const list = (data || []) as JobStatus[];
      setJobs(list);
      if (list.length && selected == null) setSelected(list[0].jobid);
    }
    setLoading(false);
  }, [selected]);

  const loadRuns = useCallback(async (jobid: number) => {
    const { data, error } = await supabase.rpc("get_scheduled_job_runs" as any, { _jobid: jobid, _limit: 50 });
    if (!error) setRuns((prev) => ({ ...prev, [jobid]: (data || []) as RunDetail[] }));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selected != null) loadRuns(selected); }, [selected, loadRuns]);

  const selectedJob = jobs.find((j) => j.jobid === selected) || null;
  const selectedRuns = selected != null ? runs[selected] || [] : [];
  const recentFailures = selectedRuns.filter((r) => (r.status || "").toLowerCase() === "failed").slice(0, 10);
  const upcoming = selectedJob ? nextRuns(selectedJob.schedule, new Date(), 5) : [];

  const statusBadge = (s: string | null) => {
    const v = (s || "").toLowerCase();
    if (v === "succeeded") return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Sucesso</Badge>;
    if (v === "failed") return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Falha</Badge>;
    if (v === "running") return <Badge className="gap-1"><Clock className="h-3 w-3" />Em execução</Badge>;
    return <Badge variant="outline">{s || "—"}</Badge>;
  };

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

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Jobs configurados</CardTitle></CardHeader>
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
              {jobs.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum job encontrado.</TableCell></TableRow>
              )}
              {jobs.map((j) => (
                <TableRow key={j.jobid} className={selected === j.jobid ? "bg-muted/40" : ""}>
                  <TableCell className="font-medium">{j.jobname || `job_${j.jobid}`}</TableCell>
                  <TableCell><code className="text-xs">{j.schedule}</code></TableCell>
                  <TableCell>{j.active ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Pausado</Badge>}</TableCell>
                  <TableCell className="text-xs">{fmt(j.last_start)}</TableCell>
                  <TableCell>{statusBadge(j.last_status)}</TableCell>
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
            <CardHeader><CardTitle className="text-base">Falhas recentes</CardTitle></CardHeader>
            <CardContent>
              {recentFailures.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem falhas recentes.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {recentFailures.map((r) => (
                    <li key={r.runid} className="border-b pb-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{fmt(r.start_time)}</span>
                        {statusBadge(r.status)}
                      </div>
                      <div className="text-xs truncate" title={r.return_message || ""}>{r.return_message || "—"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Logs (últimas {selectedRuns.length} execuções)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRuns.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem execuções registradas.</TableCell></TableRow>
                  )}
                  {selectedRuns.map((r) => (
                    <TableRow key={r.runid}>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(r.start_time)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(r.end_time)}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={r.return_message || ""}>{r.return_message || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
