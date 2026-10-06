// Eventos de segurança (risco, antifraude, privilégios, exclusões em massa, iscas).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface SecEvent {
  id: string;
  event_type: string;
  severity: string;
  target: string | null;
  details: Record<string, unknown>;
  status: string;
  created_at: string;
}

const LABEL: Record<string, string> = {
  privilege_change: "Mudança de permissão",
  mass_delete: "Exclusão em massa",
  fraud_duplicate_document: "Documento repetido em contas diferentes",
  fraud_gps_spoofing: "Localização impossível (GPS falso?)",
  fraud_review_burst: "Muitas avaliações seguidas",
  honeytoken_triggered: "Acesso a recurso-isca",
  login: "Entrada na conta",
  logout: "Saída da conta",
};

const SecurityEventsCard = () => {
  const [events, setEvents] = useState<SecEvent[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("security_events" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setEvents(((data ?? []) as unknown) as SecEvent[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    await supabase.from("security_events" as never).update({ status } as never).eq("id", id);
    void load();
  };

  return (
    <Card className="p-4 space-y-3" data-testid="security-events-card">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Eventos de segurança</p>
        <Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="w-4 h-4" /></Button>
      </div>
      {events.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}
      <div className="space-y-2 max-h-96 overflow-auto">
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-sm border-b border-border pb-2">
            <div className="min-w-0">
              <p className="truncate">{LABEL[e.event_type] ?? e.event_type}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("pt-BR")} · {e.target ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={e.severity === "critical" || e.severity === "high" ? "destructive" : "secondary"}>
                {e.severity}
              </Badge>
              {e.status !== "closed" && (
                <Button size="sm" variant="outline" onClick={() => void setStatus(e.id, "closed")}>Resolver</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default SecurityEventsCard;
