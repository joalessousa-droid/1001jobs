import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Receipt, Search, Wallet, ExternalLink, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const brl = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ServiceRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  payment_status: string;
  agreed_price: number | null;
  created_at: string;
  completed_at: string | null;
  provider_id: string;
}

interface PaymentRow {
  service_id: string;
  amount: number;
  state: string;
  captured_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  accepted: "Aceito",
  in_progress: "Em andamento",
  completed: "Concluído",
  confirmed: "Confirmado",
  disputed: "Em disputa",
  refunded: "Reembolsado",
  cancelled_by_client: "Cancelado por você",
  cancelled_by_provider: "Cancelado pelo profissional",
};

const PAY_LABEL: Record<string, string> = {
  pending: "Não pago",
  paid: "Pago",
  released: "Liberado ao profissional",
  refunded: "Reembolsado",
};

const ClientServiceHistory = () => {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [providers, setProviders] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<ServiceRow | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /* Ao voltar do checkout, sincroniza o pagamento com o gateway 1001Pay */
  useEffect(() => {
    if (params.get("payment") !== "success") return;
    void (async () => {
      await supabase.functions.invoke("pay1001", { body: { action: "sync" } });
      setReloadKey((k) => k + 1);
      toast.success("Pagamento confirmado! O valor já está na carteira do profissional.");
    })();
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data: profile } = await supabase.rpc("get_my_profile_id");
      const profileId = profile as unknown as string | null;
      if (!profileId) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: svcs } = await supabase
        .from("services")
        .select("id, title, description, status, payment_status, agreed_price, created_at, completed_at, provider_id")
        .eq("client_id", profileId)
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = (svcs ?? []) as ServiceRow[];
      const ids = rows.map((r) => r.id);
      const provIds = [...new Set(rows.map((r) => r.provider_id))];
      const [{ data: pays }, { data: profs }] = await Promise.all([
        ids.length
          ? supabase.from("service_payments").select("service_id, amount, state, captured_at").in("service_id", ids)
          : Promise.resolve({ data: [] as PaymentRow[] }),
        provIds.length
          ? supabase.from("profiles").select("id, display_name").in("id", provIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
      ]);
      if (cancelled) return;
      setServices(rows);
      setPayments((pays ?? []) as PaymentRow[]);
      setProviders(
        Object.fromEntries(((profs ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name])),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const paidFor = (serviceId: string) =>
    payments
      .filter((p) => p.service_id === serviceId && ["captured", "released"].includes(p.state))
      .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (providers[s.provider_id] ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [services, query, providers]);

  const totals = useMemo(
    () => ({
      count: services.length,
      paid: services.reduce((acc, s) => acc + paidFor(s.id), 0),
      open: services.filter((s) => !["completed", "confirmed", "refunded"].includes(s.status)).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, payments],
  );

  const pay = async (serviceId: string) => {
    setPaying(serviceId);
    try {
      const { data, error } = await supabase.functions.invoke("service-payment-checkout", {
        body: { service_id: serviceId },
      });
      const url = (data as { url?: string } | null)?.url;
      if (error || !url) {
        toast.error("Não foi possível abrir o pagamento agora.");
        return;
      }
      window.location.href = url;
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16" data-testid="client-service-history">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" /> Meus serviços
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico das suas solicitações, com status e valores pagos.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Solicitações</p>
            <p className="text-xl font-bold mt-1">{totals.count}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Em aberto</p>
            <p className="text-xl font-bold mt-1">{totals.open}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total pago</p>
            <p className="text-xl font-bold mt-1">{brl(totals.paid)}</p>
          </Card>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por serviço ou profissional"
            className="pl-9"
            data-testid="history-search"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            Nenhum serviço encontrado.
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link to="/buscar">Buscar profissionais</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const paid = paidFor(s.id);
              return (
                <Card key={s.id} className="p-4" data-testid="history-item">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{s.title}</h3>
                        <Badge variant="secondary" className="text-[10px]">
                          {STATUS_LABEL[s.status] ?? s.status}
                        </Badge>
                        <Badge
                          variant={s.payment_status === "pending" ? "outline" : "default"}
                          className="text-[10px]"
                        >
                          {PAY_LABEL[s.payment_status] ?? s.payment_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3" />
                        {format(new Date(s.created_at), "dd MMM yyyy", { locale: ptBR })} ·{" "}
                        {providers[s.provider_id] ?? "Profissional"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right mr-1">
                        <p className="text-sm font-semibold">{brl(paid || s.agreed_price)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {paid > 0 ? "pago" : "a pagar"}
                        </p>
                      </div>
                      {paid === 0 && ["accepted", "in_progress"].includes(s.status) && (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={paying === s.id}
                          onClick={() => void pay(s.id)}
                          data-testid="history-pay"
                        >
                          {paying === s.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Wallet className="w-3.5 h-3.5" />
                          )}
                          Pagar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setDetail(s)} data-testid="history-detail">
                        Detalhes
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-md" data-testid="history-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              {detail.description && <p className="text-muted-foreground">{detail.description}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] text-muted-foreground">Status</p>
                  <p className="font-medium">{STATUS_LABEL[detail.status] ?? detail.status}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] text-muted-foreground">Pagamento</p>
                  <p className="font-medium">{PAY_LABEL[detail.payment_status] ?? detail.payment_status}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] text-muted-foreground">Valor combinado</p>
                  <p className="font-medium">{brl(detail.agreed_price)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] text-muted-foreground">Valor pago</p>
                  <p className="font-medium">{brl(paidFor(detail.id))}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button asChild variant="outline" className="flex-1 gap-2">
                  <Link to={`/provider/${detail.provider_id}`}>
                    <ExternalLink className="w-4 h-4" /> Ver profissional
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 gap-2">
                  <Link to={`/servico/${detail.id}/rastreio`}>Acompanhar</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ClientServiceHistory;
