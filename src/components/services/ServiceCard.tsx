import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { transitionStatus, type ServiceRow, type ServiceStatus } from "@/hooks/useServices";
import ServiceStatusBadge from "./ServiceStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, MapPin } from "lucide-react";

interface Props {
  service: ServiceRow;
  viewerProfileId: string;
  onChanged?: () => void;
}

const ServiceCard = ({ service, viewerProfileId, onChanged }: Props) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ status: ServiceStatus; label: string; needsReason?: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [disputeId, setDisputeId] = useState<string | null>(null);

  const isClient = service.client_id === viewerProfileId;
  const isProvider = service.provider_id === viewerProfileId;
  const counterpartyName = isClient ? "Profissional" : "Cliente";

  // Buscar dispute_id se serviço estiver em disputa
  useEffect(() => {
    if (service.status !== "disputed") { setDisputeId(null); return; }
    supabase
      .from("service_disputes")
      .select("id")
      .eq("service_id", service.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setDisputeId(data?.id ?? null));
  }, [service.id, service.status]);

  const run = async (status: ServiceStatus, reasonText?: string) => {
    setBusy(status);
    try {
      // Disputa usa RPC dedicada que cria registro em service_disputes
      if (status === "disputed") {
        const { data, error } = await supabase.rpc("open_service_dispute", {
          _service_id: service.id,
          _reason: reasonText ?? "Disputa aberta",
          _description: reasonText ?? null,
        });
        if (error) throw error;
        toast({ title: "Disputa aberta" });
        if (data) {
          supabase.functions.invoke("notify-dispute-event", {
            body: { dispute_id: data, event: "opened", message: reasonText ?? "Disputa aberta" },
          }).catch(() => {});
          window.location.href = `/disputa/${data}`;
        }
      } else {
        await transitionStatus(service.id, status, reasonText);
        toast({ title: "Status atualizado" });
      }
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
      setConfirmAction(null);
      setReason("");
    }
  };

  // Botões disponíveis por status + papel
  const actions: { status: ServiceStatus; label: string; variant?: "default" | "destructive" | "outline"; needsReason?: boolean }[] = [];
  if (service.status === "pending" && isProvider) {
    actions.push({ status: "accepted", label: "Aceitar serviço" });
    actions.push({ status: "cancelled_by_provider", label: "Recusar", variant: "outline", needsReason: true });
  }
  if (service.status === "pending" && isClient) {
    actions.push({ status: "cancelled_by_client", label: "Cancelar solicitação", variant: "outline", needsReason: true });
  }
  if (service.status === "accepted" && isProvider) {
    actions.push({ status: "in_progress", label: "Iniciar serviço" });
    actions.push({ status: "cancelled_by_provider", label: "Cancelar", variant: "outline", needsReason: true });
  }
  if (service.status === "accepted" && isClient) {
    actions.push({ status: "cancelled_by_client", label: "Cancelar", variant: "outline", needsReason: true });
  }
  if (service.status === "in_progress" && isProvider) {
    actions.push({ status: "completed", label: "Marcar como concluído" });
  }
  if (service.status === "in_progress" && isClient) {
    actions.push({ status: "disputed", label: "Abrir disputa", variant: "destructive", needsReason: true });
  }
  if (service.status === "completed" && isClient) {
    actions.push({ status: "confirmed", label: "Confirmar conclusão" });
    actions.push({ status: "disputed", label: "Abrir disputa", variant: "destructive", needsReason: true });
  }

  const payState = (service as any).payment_status as string | undefined;
  const canPay =
    isClient &&
    ["accepted", "in_progress"].includes(service.status) &&
    !["paid", "released", "refunded"].includes(payState ?? "") &&
    Number((service as any).agreed_price) > 0;

  const startPayment = async () => {
    setBusy("pay");
    try {
      const { data, error } = await supabase.functions.invoke("service-payment-checkout", {
        body: { service_id: service.id },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error(data?.error ?? "checkout_failed");
    } catch (e: any) {
      toast({ title: "Erro no pagamento", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{service.title}</h3>
            {service.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{service.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {counterpartyName}: {isClient ? "—" : "—"}
            </p>
          </div>
          <ServiceStatusBadge status={service.status} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {service.agreed_price
              ? `${service.currency} ${Number(service.agreed_price).toFixed(2)}`
              : "Preço a combinar"}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(service.updated_at).toLocaleString("pt-BR")}
          </span>
        </div>

        {payState && (
          <div className="text-xs text-muted-foreground">
            Pagamento: <span className="font-medium text-foreground">{payState}</span>
          </div>
        )}

        {(actions.length > 0 || disputeId || canPay) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {canPay && (
              <Button size="sm" disabled={busy !== null} onClick={startPayment}>
                {busy === "pay" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pagar agora"}
              </Button>
            )}
            {disputeId && (
              <Button asChild size="sm" variant="destructive">
                <Link to={`/disputa/${disputeId}`}>
                  <AlertTriangle className="w-4 h-4 mr-1" /> Ver disputa
                </Link>
              </Button>
            )}
            {actions.map((a) => (
              <Button
                key={a.status}
                size="sm"
                variant={a.variant ?? "default"}
                disabled={busy !== null}
                onClick={() =>
                  a.needsReason
                    ? setConfirmAction({ status: a.status, label: a.label, needsReason: true })
                    : run(a.status)
                }
              >
                {busy === a.status ? <Loader2 className="w-4 h-4 animate-spin" /> : a.label}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={confirmAction !== null} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Informe o motivo:</p>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Voltar</Button>
            <Button
              disabled={!reason.trim() || busy !== null}
              onClick={() => confirmAction && run(confirmAction.status, reason.trim())}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ServiceCard;
