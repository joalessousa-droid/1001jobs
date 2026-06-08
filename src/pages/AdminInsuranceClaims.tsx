// Módulo 11 — Dashboard administrativo de sinistros.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { ClaimTimeline } from "@/components/insurance/ClaimTimeline";
import { toast } from "sonner";

const STATUSES = ["open", "in_review", "approved", "denied", "closed"] as const;

export default function AdminInsuranceClaims() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("open");
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    const q = supabase.from("insurance_claims").select("*").order("created_at", { ascending: false });
    const { data } = filter ? await q.eq("status", filter as any) : await q;
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filter]);

  // Realtime: refresh list on any claim change
  useEffect(() => {
    const ch = supabase
      .channel("admin-claims")
      .on("postgres_changes", { event: "*", schema: "public", table: "insurance_claims" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const c of items) by[c.status] = (by[c.status] ?? 0) + 1;
    return by;
  }, [items]);

  async function updateStatus(s: any, status: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("insurance_claims").update({
      status: status as any, resolution_notes: notes || s.resolution_notes,
      resolved_at: ["approved","denied","closed"].includes(status) ? new Date().toISOString() : null,
      resolved_by: u?.user?.id ?? null,
    }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    // E-mail para claimant + admins
    supabase.functions.invoke("insurance-notify", {
      body: { claim_id: s.id, event_type: "status_changed", message: notes || "" },
    }).catch(() => {});
    setSelected(null); setNotes(""); load();
  }

  async function exportAuditCsv() {
    const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
    const to = new Date().toISOString();
    const { data, error } = await supabase.rpc("export_insurance_audit_trail", {
      _from: from, _to: to, _claim_id: null, _event_type: null,
    });
    if (error) return toast.error(error.message);
    const rows = (data ?? []) as any[];
    if (rows.length === 0) return toast.info("Nenhum evento no período.");
    const headers = ["created_at","protocol","claim_id","event_type","actor_user_id","is_admin","before","after","message"];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((r) => [
      r.created_at, r.protocol, r.claim_id, r.event_type, r.actor_user_id,
      r.is_admin, r.before_value, r.after_value, r.message,
    ].map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `insurance-audit-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function runCleanup() {
    if (!confirm("Executar limpeza de anexos expirados agora?")) return;
    const { data, error } = await supabase.functions.invoke("insurance-cleanup", { body: {} });
    if (error) return toast.error(error.message);
    toast.success(`Limpeza: ${(data as any)?.removed_rows ?? 0} anexos removidos.`);
  }

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert className="h-6 w-6" /> Admin — Sinistros</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUSES.map((s) => (
          <Card key={s}><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{s}</p>
            <p className="text-2xl font-bold">{counts[s] ?? 0}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Em aberto</SelectItem>
            <SelectItem value="in_review">Em análise</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="denied">Negados</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load}>Recarregar</Button>
        <Button variant="outline" onClick={exportAuditCsv}>Exportar auditoria (CSV)</Button>
        <Button variant="outline" onClick={runCleanup}>Limpeza de anexos</Button>
      </div>

      {loading ? <Loader2 className="animate-spin" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{c.protocol}</span>
                  <Badge variant="outline">{c.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="line-clamp-3">{c.description}</p>
                <p className="text-xs text-muted-foreground">Ocorrência: {new Date(c.occurrence_date).toLocaleString()}</p>
                <div className="flex gap-2 pt-2">
                  <Link to={`/seguros/${c.id}`}><Button size="sm" variant="secondary">Ver anexos</Button></Link>
                  <Button size="sm" onClick={() => { setSelected(c); setNotes(c.resolution_notes ?? ""); }}>Atualizar</Button>
                </div>
                {selected?.id === c.id && (
                  <div className="space-y-2 pt-2">
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas/decisão" rows={3} />
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.filter((s) => s !== c.status).map((s) => (
                        <Button key={s} size="sm" variant="outline" onClick={() => updateStatus(c, s)}>{s}</Button>
                      ))}
                    </div>
                    <ClaimTimeline claimId={c.id} canComment />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
