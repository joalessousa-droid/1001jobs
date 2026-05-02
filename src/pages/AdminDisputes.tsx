import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";

interface Row {
  id: string;
  service_id: string;
  status: string;
  reason: string;
  created_at: string;
  resolved_at: string | null;
  refund_amount: number | null;
  resolution: string | null;
  service: { title: string; agreed_price: number | null; currency: string; status: string } | null;
}

const STATUS_FILTERS = ["all", "open", "evidence_requested", "under_review", "resolved"];

const AdminDisputes = () => {
  const { isModerator, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<Row | null>(null);
  const [decision, setDecision] = useState("resolved_split");
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("service_disputes")
      .select("id, service_id, status, reason, created_at, resolved_at, refund_amount, resolution, service:services(title, agreed_price, currency, status)")
      .order("created_at", { ascending: false });
    if (filter === "resolved") {
      q = q.in("status", ["resolved_client", "resolved_provider", "resolved_split", "closed_no_action"]);
    } else if (filter !== "all") {
      q = q.eq("status", filter as any);
    }
    const { data } = await q;
    setRows(((data as any[]) ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isModerator) load();
    // eslint-disable-next-line
  }, [isModerator, filter]);

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center pt-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isModerator) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-md pt-32 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <h1 className="text-xl font-semibold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Esta área é exclusiva para a equipe de moderação.
          </p>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!open) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("resolve_service_dispute", {
        _dispute_id: open.id,
        _decision: decision,
        _resolution: resolution,
        _refund_amount: refund ? Number(refund) : null,
        _moderator_notes: notes || null,
      });
      if (error) throw error;
      await supabase.functions.invoke("notify-dispute-event", {
        body: { dispute_id: open.id, event: "resolved", message: resolution },
      });
      toast({ title: "Disputa resolvida" });
      setOpen(null);
      setResolution(""); setRefund(""); setNotes("");
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-5xl px-4 sm:px-6 pt-24 pb-16 mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" /> Mediação de disputas
            </h1>
            <p className="text-sm text-muted-foreground">
              Revise evidências, registre decisão e aplique reembolso ou acordo.
            </p>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "Todas" :
                   s === "resolved" ? "Resolvidas" :
                   s === "open" ? "Abertas" :
                   s === "evidence_requested" ? "Aguardando evidências" :
                   "Em análise"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            Nenhuma disputa neste filtro.
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const isResolved = r.resolved_at !== null;
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <h3 className="font-semibold truncate">{r.service?.title ?? "Serviço"}</h3>
                        <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        Motivo: {r.reason}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Aberta em {new Date(r.created_at).toLocaleString("pt-BR")} •{" "}
                        {r.service?.currency} {Number(r.service?.agreed_price ?? 0).toFixed(2)}
                      </p>
                      {r.resolution && (
                        <p className="text-xs text-emerald-500 mt-1">
                          Decisão: {r.resolution}{r.refund_amount ? ` • Reembolso ${r.service?.currency} ${Number(r.refund_amount).toFixed(2)}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/disputa/${r.id}`}>
                          Ver <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                      {!isResolved && (
                        <Dialog open={open?.id === r.id} onOpenChange={(o) => setOpen(o ? r : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm">Resolver</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Resolver disputa</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div>
                                <Label>Decisão</Label>
                                <Select value={decision} onValueChange={setDecision}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="resolved_client">Favor do cliente — reembolso total</SelectItem>
                                    <SelectItem value="resolved_provider">Favor do profissional — manter pagamento</SelectItem>
                                    <SelectItem value="resolved_split">Acordo — split (reembolso parcial)</SelectItem>
                                    <SelectItem value="closed_no_action">Encerrar sem ação</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Resolução (visível para as partes)</Label>
                                <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} />
                              </div>
                              {(decision === "resolved_client" || decision === "resolved_split") && (
                                <div>
                                  <Label>Valor de reembolso</Label>
                                  <Input
                                    type="number" step="0.01" min="0"
                                    value={refund} onChange={(e) => setRefund(e.target.value)}
                                    placeholder={`${r.service?.currency} 0.00`}
                                  />
                                </div>
                              )}
                              <div>
                                <Label>Notas internas (não visíveis)</Label>
                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
                              <Button onClick={submit} disabled={saving || !resolution.trim()}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar decisão"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDisputes;
