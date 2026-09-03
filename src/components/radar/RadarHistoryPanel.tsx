import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import {
  useRadarHistory,
  clearRadarLocalHistory,
  type RadarHistoryRequest,
} from "@/hooks/useRadarHistory";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const RequestRow = ({ req }: { req: RadarHistoryRequest }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border p-2.5" data-testid="radar-history-item">
      <button
        className="w-full text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {req.category_name ?? req.description ?? "Solicitação"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {fmt(req.created_at)} · {req.offers_total} ofertas · {req.quotes_total} preços
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {req.sandbox && (
              <Badge variant="outline" className="text-[10px]">
                teste
              </Badge>
            )}
            {req.accepted_price != null && (
              <Badge className="text-[10px]">{brl(req.accepted_price)}</Badge>
            )}
            {open ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-1 border-t pt-2">
          {req.accepted_provider && (
            <p className="text-[11px] text-muted-foreground">
              Contratado: <span className="font-medium">{req.accepted_provider}</span>
            </p>
          )}
          {req.events.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Sem etapas registradas.</p>
          ) : (
            req.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate">
                  <span className="text-muted-foreground">{fmt(e.at)}</span> · {e.label}
                  {e.provider_name ? ` — ${e.provider_name}` : ""}
                </span>
                {e.price != null && <span className="font-medium shrink-0">{brl(e.price)}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const RadarHistoryPanel = ({ profileId }: { profileId?: string | null }) => {
  const { requests, loading } = useRadarHistory(profileId);

  return (
    <Card className="p-3 space-y-2" data-testid="radar-history">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Histórico de solicitações
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={clearRadarLocalHistory}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar testes
        </Button>
      </div>

      {loading && requests.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Carregando…</p>
      ) : requests.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Nenhuma solicitação ainda. Ative o radar para começar.
        </p>
      ) : (
        <ScrollArea className="max-h-72">
          <div className="space-y-1.5 pr-2">
            {requests.map((r) => (
              <RequestRow key={r.id} req={r} />
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};

export default RadarHistoryPanel;
