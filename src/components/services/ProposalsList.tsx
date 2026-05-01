import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gavel, CheckCircle2, XCircle } from "lucide-react";

interface Proposal {
  id: string;
  service_request_id: string;
  provider_id: string;
  amount: number;
  currency: string;
  message: string | null;
  estimated_days: number | null;
  status: string;
  created_at: string;
  provider?: { display_name: string; avatar_url: string | null } | null;
}

interface Props {
  serviceRequestId: string;
  ownerProfileId: string;
  myProfileId: string;
  myUserType: "client" | "provider";
}

const ProposalsList = ({ serviceRequestId, ownerProfileId, myProfileId, myUserType }: Props) => {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [days, setDays] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOwner = myProfileId === ownerProfileId;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_proposals")
      .select("*")
      .eq("service_request_id", serviceRequestId)
      .order("created_at", { ascending: false });
    if (data) {
      // Buscar nomes dos providers em paralelo
      const ids = Array.from(new Set(data.map((p: any) => p.provider_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        setProposals(data.map((p: any) => ({ ...p, provider: map.get(p.provider_id) ?? null })));
      } else {
        setProposals(data as any);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`proposals-${serviceRequestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_proposals", filter: `service_request_id=eq.${serviceRequestId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [serviceRequestId]);

  const submitProposal = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("service_proposals").insert({
      service_request_id: serviceRequestId,
      provider_id: myProfileId,
      amount: amt,
      message: message.trim() || null,
      estimated_days: days ? Number(days) : null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setOpenForm(false);
    setAmount(""); setMessage(""); setDays("");
    toast({ title: "Proposta enviada" });
    load();
  };

  const accept = async (proposalId: string) => {
    setAccepting(proposalId);
    const { error } = await supabase.rpc("accept_service_proposal", { _proposal_id: proposalId });
    setAccepting(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Proposta aceita — serviço criado!" });
    load();
  };

  const myProposal = proposals.find((p) => p.provider_id === myProfileId && p.status === "pending");

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Gavel className="w-4 h-4 text-primary" />
          Propostas ({proposals.length})
        </h3>
        {!isOwner && myUserType === "provider" && !myProposal && (
          <Button size="sm" onClick={() => setOpenForm(true)}>Enviar proposta</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {isOwner ? "Ainda não há propostas. Aguarde profissionais responderem." : "Seja o primeiro a enviar uma proposta."}
        </p>
      ) : (
        <div className="space-y-2">
          {proposals.map((p) => (
            <div key={p.id} className="p-3 rounded-xl border border-border bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{p.provider?.display_name ?? "Profissional"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                    {p.estimated_days != null && ` · ${p.estimated_days} dia(s)`}
                  </p>
                  {p.message && <p className="text-sm mt-2 line-clamp-3">{p.message}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary">{p.currency} {Number(p.amount).toFixed(2)}</p>
                  {p.status === "accepted" && <span className="text-xs text-emerald-500 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Aceita</span>}
                  {p.status === "rejected" && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejeitada</span>}
                  {p.status === "pending" && isOwner && (
                    <Button size="sm" className="mt-2" onClick={() => accept(p.id)} disabled={accepting !== null}>
                      {accepting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceitar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar proposta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="amount">Valor (BRL)</Label>
              <Input id="amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="days">Prazo estimado (dias)</Label>
              <Input id="days" type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="message">Mensagem ao cliente</Label>
              <Textarea id="message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explique sua experiência, escopo e diferencial..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button onClick={submitProposal} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ProposalsList;
