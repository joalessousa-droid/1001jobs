import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Send, Loader2, UserRound, Briefcase } from "lucide-react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { notifyAppointment } from "@/lib/notifyAppointment";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const h = 7 + Math.floor(i / 2);
  return `${String(h).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`;
});

const DURATIONS = [30, 60, 90, 120, 180, 240];

interface Option {
  id: string;
  label: string;
  sub?: string | null;
}

/** Tela completa de agendamento: o profissional propõe data/hora/serviço e o cliente confirma. */
const ScheduleAppointment = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [userType, setUserType] = useState<"client" | "provider">("provider");
  const [clients, setClients] = useState<Option[]>([]);
  const [services, setServices] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, user_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !profile) {
        setLoading(false);
        return;
      }
      setProfileId(profile.id);
      setUserType((profile.user_type as "client" | "provider") ?? "provider");

      const [{ data: svcs }, { data: apts }, { data: jobs }] = await Promise.all([
        supabase
          .from("provider_services")
          .select("id, description, hourly_rate, service_categories(name)")
          .eq("provider_id", profile.id),
        supabase
          .from("appointments")
          .select("client_id, client:profiles!appointments_client_id_fkey(id, display_name, city)")
          .eq("provider_id", profile.id)
          .limit(100),
        supabase
          .from("services")
          .select("client_id, client:profiles!services_client_id_fkey(id, display_name, city)")
          .eq("provider_id", profile.id)
          .limit(100),
      ]);
      if (cancelled) return;

      setServices(
        (svcs ?? []).map((s: any) => ({
          id: s.id,
          label: s.service_categories?.name ?? "Serviço",
          sub: s.hourly_rate ? `R$ ${Number(s.hourly_rate).toFixed(2)}/h` : s.description,
        })),
      );

      const map = new Map<string, Option>();
      for (const row of [...(apts ?? []), ...(jobs ?? [])] as any[]) {
        const c = row.client;
        if (c?.id) map.set(c.id, { id: c.id, label: c.display_name ?? "Cliente", sub: c.city });
      }
      setClients([...map.values()]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const canSubmit = useMemo(
    () => !!profileId && !!clientId && !!date && !!time && !saving,
    [profileId, clientId, date, time, saving],
  );

  const submit = async () => {
    if (!profileId || !clientId || !date || !time) return;
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      client_id: clientId,
      provider_id: profileId,
      service_id: serviceId || null,
      scheduled_date: format(date, "yyyy-MM-dd"),
      scheduled_time: time,
      duration_minutes: Number(duration),
      notes: notes || null,
      // proposta do profissional: aguarda a confirmação do cliente antes do aceite
      status: "proposed",
    });
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao propor agendamento", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Proposta enviada!",
      description: "O cliente precisa confirmar a data e o horário antes do aceite.",
    });
    notifyAppointment({
      event: "created",
      providerId: profileId,
      clientId,
      scheduledDate: format(date, "dd/MM/yyyy"),
      scheduledTime: time,
      serviceName: services.find((s) => s.id === serviceId)?.label,
      notes: notes || undefined,
    });
    navigate("/dashboard?tab=agenda");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main
        className="container max-w-2xl mx-auto px-4 pt-24 pb-16 space-y-6"
        data-testid="schedule-appointment-page"
      >
        <header className="space-y-1">
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" /> Novo agendamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Escolha cliente, serviço, data e horário. A proposta só vira agendamento após a
            confirmação do cliente.
          </p>
        </header>

        {userType !== "provider" && (
          <Card className="p-4 text-sm text-muted-foreground">
            Esta tela é do profissional. Como cliente, você confirma as propostas em Painel &gt;
            Agenda &amp; Ganhos.
          </Card>
        )}

        <Card className="p-5 space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <UserRound className="w-3.5 h-3.5" /> Cliente
            </Label>
            {clients.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum cliente encontrado ainda. Agendamentos surgem após o primeiro contato ou
                serviço.
              </p>
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger data-testid="schedule-client">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                      {c.sub ? ` · ${c.sub}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Serviço
            </Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger data-testid="schedule-service">
                <SelectValue placeholder="Selecione o serviço (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                    {s.sub ? ` · ${s.sub}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-testid="schedule-date"
                    className={cn("w-full justify-start font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Horário</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger data-testid="schedule-time">
                  <SelectValue placeholder="Selecione o horário" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {TIME_SLOTS.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> {t}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duração estimada</Label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <Badge
                  key={d}
                  onClick={() => setDuration(String(d))}
                  className={cn(
                    "cursor-pointer px-3 py-1.5",
                    duration === String(d)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-muted",
                  )}
                >
                  {d >= 60 ? `${d / 60}h` : `${d}min`}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Detalhes para o cliente</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que será feito, materiais, endereço de atendimento..."
              className="min-h-[90px]"
            />
          </div>

          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full gap-2"
            data-testid="schedule-submit"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar proposta ao cliente
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default ScheduleAppointment;
