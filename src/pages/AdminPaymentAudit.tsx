import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ShieldCheck, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";

interface AuditRow {
  id: string;
  service_id: string | null;
  payment_id: string | null;
  source: string;
  event_type: string;
  status: string;
  message: string | null;
  stripe_event_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
  amount: number | null;
  currency: string | null;
  ip_address: string | null;
  user_agent: string | null;
  payload: any;
  error_detail: any;
  created_at: string;
}

const STATUS_VARIANTS: Record<string, { label: string; variant: any }> = {
  info: { label: "info", variant: "secondary" },
  success: { label: "sucesso", variant: "default" },
  warning: { label: "atenção", variant: "outline" },
  error: { label: "erro", variant: "destructive" },
};

const SOURCES = ["all", "checkout", "webhook", "refund", "manual"];
const STATUSES = ["all", "info", "success", "warning", "error"];

const AdminPaymentAudit = () => {
  const { isModerator, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<AuditRow | null>(null);

  useEffect(() => {
    if (!roleLoading && !isModerator) navigate("/");
  }, [isModerator, roleLoading, navigate]);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("service_payment_audit_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (source !== "all") query = query.eq("source", source);
    if (status !== "all") query = query.eq("status", status);
    const { data } = await query;
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isModerator) load(); }, [isModerator, source, status]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      [r.event_type, r.message, r.service_id, r.payment_id, r.stripe_event_id,
       r.stripe_payment_intent_id, r.stripe_session_id]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const errors = filtered.filter((r) => r.status === "error").length;
    const warnings = filtered.filter((r) => r.status === "warning").length;
    const success = filtered.filter((r) => r.status === "success").length;
    return { total, errors, warnings, success };
  }, [filtered]);

  if (roleLoading || !isModerator) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Auditoria de Pagamentos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tentativas de checkout, eventos do Stripe e falhas de processamento.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Sucesso</div><div className="text-2xl font-bold text-emerald-500">{stats.success}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Atenção</div><div className="text-2xl font-bold text-amber-500">{stats.warnings}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Erros</div><div className="text-2xl font-bold text-destructive">{stats.errors}</div></Card>
        </div>

        <Card className="p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Origem</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Buscar (evento, ID, mensagem)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="checkout.attempt, svc-id, pi_..." className="pl-9" />
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Quando</th>
                    <th className="text-left px-3 py-2">Origem</th>
                    <th className="text-left px-3 py-2">Evento</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Serviço</th>
                    <th className="text-left px-3 py-2">Valor</th>
                    <th className="text-left px-3 py-2">Mensagem</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted-foreground py-8">Sem registros.</td></tr>
                  )}
                  {filtered.map((r) => {
                    const v = STATUS_VARIANTS[r.status] ?? STATUS_VARIANTS.info;
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/20">
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {format(new Date(r.created_at), "dd/MM HH:mm:ss")}
                        </td>
                        <td className="px-3 py-2"><Badge variant="outline">{r.source}</Badge></td>
                        <td className="px-3 py-2 font-mono text-xs">{r.event_type}</td>
                        <td className="px-3 py-2"><Badge variant={v.variant}>{v.label}</Badge></td>
                        <td className="px-3 py-2 font-mono text-xs truncate max-w-[120px]">
                          {r.service_id ? r.service_id.slice(0, 8) : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.amount != null ? `${r.amount} ${r.currency ?? ""}` : "—"}
                        </td>
                        <td className="px-3 py-2 max-w-md truncate">{r.message ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>Ver</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Detalhes do evento</DialogTitle></DialogHeader>
            {open && (
              <div className="space-y-3 text-sm">
                <Detail label="Quando" value={format(new Date(open.created_at), "dd/MM/yyyy HH:mm:ss")} />
                <Detail label="Origem" value={open.source} />
                <Detail label="Evento" value={open.event_type} />
                <Detail label="Status" value={open.status} />
                <Detail label="Mensagem" value={open.message ?? "—"} />
                <Detail label="Service ID" value={open.service_id ?? "—"} />
                <Detail label="Payment ID" value={open.payment_id ?? "—"} />
                <Detail label="Stripe Event ID" value={open.stripe_event_id ?? "—"} />
                <Detail label="Payment Intent" value={open.stripe_payment_intent_id ?? "—"} />
                <Detail label="Session" value={open.stripe_session_id ?? "—"} />
                <Detail label="Valor" value={open.amount != null ? `${open.amount} ${open.currency ?? ""}` : "—"} />
                <Detail label="IP" value={open.ip_address ?? "—"} />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Payload</div>
                  <pre className="bg-muted/30 p-3 rounded text-xs overflow-x-auto max-h-48">
                    {JSON.stringify(open.payload, null, 2)}
                  </pre>
                </div>
                {open.error_detail && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Erro</div>
                    <pre className="bg-destructive/10 text-destructive p-3 rounded text-xs overflow-x-auto max-h-48">
                      {JSON.stringify(open.error_detail, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-3 gap-2">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="col-span-2 font-mono text-xs break-all">{value}</div>
  </div>
);

export default AdminPaymentAudit;
