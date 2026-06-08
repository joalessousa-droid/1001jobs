import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const EVENT_TYPES = [
  "created", "status_changed", "attachment_uploaded", "attachment_deleted",
  "comment_added", "decision", "closed",
];

const PAGE_SIZE = 50;

type Row = {
  created_at: string;
  event_type: string;
  actor_user_id: string | null;
  actor_profile_id: string | null;
  is_admin: boolean | null;
  message: string | null;
  metadata: any;
};

export default function InsuranceClaimAudit() {
  const { id } = useParams<{ id: string }>();
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const evt = filter === "all" ? null : filter;
    const [{ data, error }, { data: cnt }] = await Promise.all([
      supabase.rpc("get_insurance_claim_audit", { _claim_id: id, _event_type: evt, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE }),
      supabase.rpc("get_insurance_claim_audit_count", { _claim_id: id, _event_type: evt }),
    ]);
    setLoading(false);
    if (error) { console.error(error); return; }
    setRows((data as any) || []);
    setTotal(Number(cnt) || 0);
  }, [id, filter, page]);

  useEffect(() => { load(); }, [load]);

  // Realtime: recarrega lista e contador quando um novo evento for inserido para este claim.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`claim-audit-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "insurance_claim_events", filter: `claim_id=eq.${id}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);


  const exportCsv = async () => {
    if (!id) return;
    const evt = filter === "all" ? null : filter;
    const all: Row[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.rpc("get_insurance_claim_audit", {
        _claim_id: id, _event_type: evt, _limit: 1000, _offset: offset,
      });
      if (error || !data || data.length === 0) break;
      all.push(...(data as any));
      if (data.length < 1000) break;
      offset += 1000;
    }
    const header = ["created_at", "event_type", "actor_user_id", "actor_profile_id", "is_admin", "message", "metadata"];
    const csv = [header.join(",")]
      .concat(all.map((r) => header.map((h) => {
        const v = (r as any)[h];
        const s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      }).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `claim-${id}-audit.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Auditoria do sinistro</h1>
        <Link to={`/seguros/${id}`}><Button variant="outline" size="sm">Voltar ao sinistro</Button></Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo de evento</label>
              <Select value={filter} onValueChange={(v) => { setPage(0); setFilter(v); }}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {EVENT_TYPES.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={exportCsv} variant="secondary">Exportar CSV</Button>
            <div className="ml-auto text-sm text-muted-foreground">{total} eventos</div>
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="sr-only">Eventos</CardTitle>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando…</div>
          ) : (
            <div className="divide-y">
              {rows.map((r, i) => (
                <div key={i} className="py-3 text-sm flex gap-3">
                  <div className="w-44 shrink-0 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                  <Badge variant={r.is_admin ? "default" : "secondary"} className="h-6 shrink-0">{r.event_type}</Badge>
                  <div className="flex-1">
                    <div>{r.message || <span className="text-muted-foreground">—</span>}</div>
                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <pre className="mt-1 text-xs bg-muted/50 rounded p-2 overflow-x-auto">{JSON.stringify(r.metadata, null, 2)}</pre>
                    )}
                  </div>
                </div>
              ))}
              {rows.length === 0 && <div className="py-8 text-center text-muted-foreground">Sem eventos.</div>}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <div className="text-xs text-muted-foreground">Página {page + 1} de {pages}</div>
            <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
