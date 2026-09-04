import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Repeat, Trash2, Plus } from "lucide-react";
import {
  useRecurringServices,
  FREQUENCY_LABEL,
  type Frequency,
} from "@/hooks/useRecurringServices";

/** Serviços recorrentes: repetir um serviço semanal, quinzenal, mensal ou personalizado. */
const RecurringServicesPanel = ({ defaultTitle }: { defaultTitle?: string }) => {
  const { items, loading, create, toggleActive, remove, canManage } = useRecurringServices();
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Informe o serviço que deseja repetir.");
      return;
    }
    setSaving(true);
    try {
      await create({
        title: title.trim(),
        frequency,
        interval_days: frequency === "custom" ? days : undefined,
      });
      setTitle("");
      toast.success("Serviço recorrente agendado.");
    } catch {
      toast.error("Não foi possível salvar a recorrência.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 md:p-6" data-testid="recurring-services">
      <div className="flex items-center gap-2 mb-4">
        <Repeat className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Serviços recorrentes</h3>
      </div>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">Entre na sua conta para programar repetições.</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] items-center">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Limpeza da casa"
              data-testid="recurring-title"
            />
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger className="w-full sm:w-40" data-testid="recurring-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCY_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={submit} disabled={saving} className="gap-2" data-testid="recurring-save">
              <Plus className="w-4 h-4" /> Programar
            </Button>
          </div>

          {frequency === "custom" && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">A cada</span>
              <Input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-muted-foreground">dias</span>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!loading && items.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma recorrência programada ainda.</p>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {FREQUENCY_LABEL[item.frequency]} · próximo em{" "}
                    {new Date(item.next_run_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.active ? "default" : "outline"}>
                    {item.active ? "Ativo" : "Pausado"}
                  </Badge>
                  <Switch
                    checked={item.active}
                    onCheckedChange={(v) => toggleActive(item.id, v)}
                    aria-label="Ativar recorrência"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover recorrência"
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};

export default RecurringServicesPanel;
