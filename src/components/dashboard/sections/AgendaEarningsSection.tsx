import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppointmentList from "@/components/scheduling/AppointmentList";
import { CalendarDays, Wallet, TrendingUp, Loader2, ExternalLink, Clock, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  profileId: string;
  userType: "client" | "provider";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface PaymentRow {
  amount: number;
  platform_fee: number | null;
  state: string;
  created_at: string;
  captured_at: string | null;
  released_at: string | null;
}

interface UpcomingService {
  id: string;
  description: string | null;
  created_at: string;
  status: string;
}

const AgendaEarningsSection = ({ profileId, userType }: Props) => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [services, setServices] = useState<UpcomingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingWallet, setOpeningWallet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const [{ data: pays }, { data: svcs }] = await Promise.all([
        supabase
          .from("service_payments")
          .select("amount, platform_fee, state, created_at, captured_at, released_at")
          .eq("provider_id", profileId)
          .gte("created_at", since.toISOString()),
        supabase
          .from("services")
          .select("id, description, created_at, status")
          .eq("provider_id", profileId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      setPayments((pays ?? []) as PaymentRow[]);
      setServices((svcs ?? []) as UpcomingService[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const totals = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const earned = payments.filter((p) => ["captured", "released"].includes(p.state));
    const net = (p: PaymentRow) => Number(p.amount ?? 0) - Number(p.platform_fee ?? 0);
    const at = (p: PaymentRow) => new Date(p.released_at ?? p.captured_at ?? p.created_at);
    const sum = (from: Date) =>
      earned.filter((p) => at(p) >= from).reduce((acc, p) => acc + net(p), 0);

    return {
      day: sum(startOfDay),
      week: sum(startOfWeek),
      month: sum(startOfMonth),
      pending: payments
        .filter((p) => ["pending", "authorized"].includes(p.state))
        .reduce((acc, p) => acc + net(p), 0),
      received: earned.reduce((acc, p) => acc + net(p), 0),
      fees: earned.reduce((acc, p) => acc + Number(p.platform_fee ?? 0), 0),
    };
  }, [payments]);

  const openWallet = async () => {
    setOpeningWallet(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session");
      const url = (data as { url?: string } | null)?.url;
      if (error || !url) {
        toast.error("Não foi possível abrir a carteira 1001Pay agora.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningWallet(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="agenda-earnings-section">
      <div>
        <h2 className="text-2xl font-bold font-display flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" />
          Agenda & Ganhos
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Seus atendimentos agendados e o que você recebeu na plataforma
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Hoje", value: totals.day, icon: Clock },
              { label: "Semana", value: totals.week, icon: TrendingUp },
              { label: "Mês", value: totals.month, icon: TrendingUp },
              { label: "A receber", value: totals.pending, icon: Wallet },
            ].map((k) => (
              <Card key={k.label} className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <k.icon className="w-3.5 h-3.5" /> {k.label}
                </div>
                <p className="text-lg sm:text-xl font-bold mt-1">{brl(k.value)}</p>
              </Card>
            ))}
          </div>

          <Card className="p-5 space-y-4" data-testid="pay1001-wallet">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" /> Conta 1001Pay
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Carteira conectada ao gateway de pagamentos do app: os valores abaixo são os
                  pagamentos reais dos seus serviços.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={openingWallet}
                  onClick={openWallet}
                  data-testid="pay1001-open"
                >
                  {openingWallet ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Abrir carteira
                </Button>
                <Button asChild className="gap-2">
                  <Link to="/agendar" data-testid="agenda-new-appointment">
                    <Plus className="w-4 h-4" /> Agendar
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Recebido (90d)</p>
                <p className="text-sm font-semibold">{brl(totals.received)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">A liberar</p>
                <p className="text-sm font-semibold">{brl(totals.pending)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Taxas</p>
                <p className="text-sm font-semibold">{brl(totals.fees)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Atendimentos agendados
            </h3>
            <AppointmentList profileId={profileId} userType={userType} />
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-display font-semibold">Serviços solicitados na plataforma</h3>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.description ?? "Serviço"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default AgendaEarningsSection;
