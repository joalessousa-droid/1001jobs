import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { notifyAppointment } from "@/lib/notifyAppointment";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AppointmentBookingProps {
  providerId: string;
  providerName: string;
  services: { id: string; name: string }[];
}

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00",
];

const AppointmentBooking = ({ providerId, providerName, services }: AppointmentBookingProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !date || !time) return;

    setSaving(true);

    // Get my profile id
    const { data: profileData } = await supabase.rpc("get_my_profile_id");
    if (!profileData) {
      toast({ title: "Erro ao obter perfil", variant: "destructive" });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      client_id: profileData,
      provider_id: providerId,
      service_id: serviceId || null,
      scheduled_date: format(date, "yyyy-MM-dd"),
      scheduled_time: time,
      notes: notes || null,
    });

    if (error) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento solicitado!", description: "O profissional será notificado." });
      // Send email notification (fire and forget)
      notifyAppointment({
        event: "created",
        providerId,
        clientId: profileData,
        scheduledDate: format(date, "dd/MM/yyyy"),
        scheduledTime: time,
        serviceName: services.find((s) => s.id === serviceId)?.name,
        notes: notes || undefined,
      });
      setOpen(false);
      setDate(undefined);
      setTime("");
      setServiceId("");
      setNotes("");
    }
    setSaving(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-xl">
          <CalendarIcon className="w-4 h-4" />
          Agendar serviço
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Agendar com {providerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {services.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Serviço</label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Horário</label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o horário" />
              </SelectTrigger>
              <SelectContent>
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

          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações (opcional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva o que precisa..."
              className="min-h-[80px]"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!date || !time || saving}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {saving ? "Agendando..." : "Solicitar agendamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentBooking;
