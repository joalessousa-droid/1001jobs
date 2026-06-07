import { History, ArrowDown, ArrowUp, Minus, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buildEtaHistoryPoints, formatEta, type EtaHistoryEntry } from "@/lib/etaHistory";

interface Props {
  history: EtaHistoryEntry[] | null | undefined;
  degraded?: boolean;
}

const deltaPresentation = (deltaSec: number | null) => {
  if (deltaSec == null) return { icon: Minus, className: "text-muted-foreground", label: "—" };
  const abs = Math.abs(deltaSec);
  const min = Math.round(abs / 60);
  const label = min >= 1 ? `${min} min` : `${abs}s`;
  if (deltaSec > 30) return { icon: ArrowUp, className: "text-destructive", label: `+${label}` };
  if (deltaSec < -30) return { icon: ArrowDown, className: "text-green-500", label: `−${label}` };
  return { icon: Minus, className: "text-muted-foreground", label: "estável" };
};

const EtaHistoryPanel = ({ history, degraded }: Props) => {
  const points = buildEtaHistoryPoints(history, 8).reverse(); // newest first

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History className="w-4 h-4 text-primary" />
          Histórico de ETA
        </div>
        {degraded && (
          <div className="flex items-center gap-1 text-[11px] text-amber-500" role="status" aria-live="polite">
            <AlertTriangle className="w-3 h-3" />
            Rotas indisponível
          </div>
        )}
      </div>

      {points.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sem atualizações ainda. Os próximos cálculos aparecerão aqui.
        </p>
      ) : (
        <ul className="space-y-2">
          {points.map((p) => {
            const { icon: Icon, className, label } = deltaPresentation(p.deltaSec);
            return (
              <li
                key={p.at}
                className="flex items-center justify-between text-xs border-b border-border/40 last:border-0 pb-1.5 last:pb-0"
              >
                <span className="text-muted-foreground tabular-nums">{p.relativeLabel}</span>
                <span className="font-semibold tabular-nums">{formatEta(p.eta_seconds)}</span>
                <span className={`flex items-center gap-1 ${className} tabular-nums`}>
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground">
        Variação estimada vs. amostra anterior. Atualizado automaticamente.
      </p>
    </Card>
  );
};

export default EtaHistoryPanel;
