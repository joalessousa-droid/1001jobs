import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TIME_SLOTS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientProfileId: string | null;
  providerId: string | null;
  providerName?: string | null;
  defaultNotes?: string;
  /** oferta aceita no radar — cria serviço + agenda + cobrança */
  offerId?: string | null;
  /** valor combinado com o profissional (R$) */
  price?: number | null;
}

/** Agendamento de atendimento direto do Radar (durante o match) */
const RadarScheduleDialog = ({
  open,
  onOpenChange,
  clientProfileId,
  providerId,
  providerName,
  defaultNotes = "",
  offerId = null,
  price = null,
}: Props) => {
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState(defaultNotes);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);

  const pay = async (id: string) => {
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("service-payment-checkout", {
        body: { service_id: id },
      });
      const url = (data as { url?: string } | null)?.url;
      if (error || !url) {
        toast.error("Não foi possível abrir o pagamento agora.");
        return;
      }
      window.location.href = url;
    } finally {
      setPaying(false);
    }
  };

  const submit = async () => {
    if (!clientProfileId || !providerId || !date || !time) return;
    setSaving(true);

    if (offerId) {
      const { data, error } = await supabase.rpc("radar_accept_and_schedule" as any, {
        _offer_id: offerId,
        _scheduled_date: format(date, "yyyy-MM-dd"),
        _scheduled_time: time,
        _duration_minutes: 60,
        _notes: notes.trim() || null,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message ?? "Não foi possível agendar o atendimento.");
        return;
      }
      const res = data as { service_id?: string } | null;
      setServiceId(res?.service_id ?? null);
      toast.success("Agendado! Já aparece na agenda do profissional.");
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      client_id: clientProfileId,
      provider_id: providerId,
      scheduled_date: format(date, "yyyy-MM-dd"),
      scheduled_time: time,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível agendar o atendimento.");
      return;
    }
    toast.success("Atendimento agendado! O profissional foi notificado.");
    onOpenChange(false);
    setDate(undefined);
    setTime("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md z-[1200]"
        overlayClassName="z-[1190]"
        data-testid="radar-schedule-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display">
            Agendar atendimento{providerName ? ` com ${providerName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
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
                  disabled={(d) => d < new Date(new Date().toDateString())}
                  initialFocus
                  className="p-3 pointer-events-auto"
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
            <label className="text-sm font-medium mb-1.5 block">Observações</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do atendimento…"
              className="min-h-[70px]"
            />
          </div>

          {price != null && price > 0 && (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Valor combinado</span>
              <span className="font-semibold">
                {price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          )}

          {serviceId ? (
            <div className="space-y-2">
              <Button
                className="w-full gap-2"
                disabled={paying}
                onClick={() => void pay(serviceId)}
                data-testid="radar-pay-service"
              >
                <Wallet className="w-4 h-4" />
                {paying ? "Abrindo pagamento…" : "Pagar agora (1001Pay)"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                Pagar depois
              </Button>
            </div>
          ) : (
          <Button
            className="w-full gap-2"
            disabled={!date || !time || saving || !clientProfileId || !providerId}
            onClick={() => void submit()}
            data-testid="radar-schedule-submit"
          >
            <Send className="w-4 h-4" />
            {saving ? "Agendando…" : "Confirmar agendamento"}
          </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RadarScheduleDialog;
