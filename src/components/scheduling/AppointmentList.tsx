import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notifyAppointment } from "@/lib/notifyAppointment";

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  other_name: string;
  service_name: string | null;
  is_provider: boolean;
  client_id: string;
  provider_id: string;
}

interface AppointmentListProps {
  profileId: string;
  userType: "client" | "provider";
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  proposed: { label: "Aguardando cliente", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  completed: { label: "Concluído", variant: "outline" },
};

const AppointmentList = ({ profileId, userType }: AppointmentListProps) => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id, scheduled_date, scheduled_time, duration_minutes, status, notes, client_id, provider_id,
        client:profiles!appointments_client_id_fkey(display_name),
        provider:profiles!appointments_provider_id_fkey(display_name),
        service:provider_services!appointments_service_id_fkey(
          service_categories(name)
        )
      `)
      .order("scheduled_date", { ascending: true });

    if (data) {
      setAppointments(
        data.map((a: any) => ({
          id: a.id,
          scheduled_date: a.scheduled_date,
          scheduled_time: a.scheduled_time,
          duration_minutes: a.duration_minutes,
          status: a.status,
          notes: a.notes,
          other_name: userType === "provider" ? a.client?.display_name || "Cliente" : a.provider?.display_name || "Profissional",
          service_name: a.service?.service_categories?.name || null,
          is_provider: userType === "provider",
          client_id: a.client_id,
          provider_id: a.provider_id,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [profileId]);

  const updateStatus = async (apt: Appointment, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", apt.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Agendamento ${status === "confirmed" ? "confirmado" : "cancelado"}!` });
      notifyAppointment({
        event: status as "confirmed" | "cancelled",
        providerId: apt.provider_id,
        clientId: apt.client_id,
        scheduledDate: format(new Date(apt.scheduled_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }),
        scheduledTime: apt.scheduled_time.slice(0, 5),
        serviceName: apt.service_name || undefined,
      });
      fetchAppointments();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-8">
        <CalendarIcon className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum agendamento</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((apt) => {
        const statusInfo = STATUS_MAP[apt.status] || STATUS_MAP.pending;
        return (
          <div key={apt.id} className="p-4 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm text-foreground">{apt.other_name}</p>
                {apt.service_name && (
                  <p className="text-xs text-muted-foreground">{apt.service_name}</p>
                )}
              </div>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {format(new Date(apt.scheduled_date + "T12:00:00"), "dd MMM yyyy", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {apt.scheduled_time.slice(0, 5)}
              </span>
            </div>

            {apt.notes && (
              <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">{apt.notes}</p>
            )}

            {apt.status === "proposed" && (
              <div className="flex gap-2 pt-1">
                {!apt.is_provider ? (
                  <Button size="sm" className="gap-1 text-xs h-7" data-testid="appointment-client-confirm" onClick={() => updateStatus(apt, "confirmed")}>
                    <CheckCircle className="w-3 h-3" /> Confirmar proposta
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground self-center">
                    Aguardando confirmação do cliente
                  </span>
                )}
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => updateStatus(apt, "cancelled")}>
                  <XCircle className="w-3 h-3" /> Cancelar
                </Button>
              </div>
            )}

            {apt.status === "pending" && (
              <div className="flex gap-2 pt-1">
                {apt.is_provider && (
                  <Button size="sm" variant="default" className="gap-1 text-xs h-7" onClick={() => updateStatus(apt, "confirmed")}>
                    <CheckCircle className="w-3 h-3" /> Confirmar
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => updateStatus(apt, "cancelled")}>
                  <XCircle className="w-3 h-3" /> Cancelar
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AppointmentList;
