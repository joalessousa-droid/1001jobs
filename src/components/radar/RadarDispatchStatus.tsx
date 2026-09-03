import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { RADAR_STAGES, RADAR_STAGE_LABEL, type RadarStage } from "@/hooks/useProfessionalRadar";

interface Props {
  stage: RadarStage;
  /** prazo da oferta pendente (ISO) — barra regressiva */
  expiresAt?: string | null;
  /** janela da barra regressiva em segundos (padrão 30s) */
  windowSec?: number;
  remainingKm?: number | null;
  etaMin?: number | null;
}

const RadarDispatchStatus = ({ stage, expiresAt, windowSec = 30, remainingKm, etaMin }: Props) => {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setLeft(0);
      return;
    }
    const tick = () =>
      setLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 500);
    return () => window.clearInterval(t);
  }, [expiresAt]);

  const currentIndex = RADAR_STAGES.indexOf(stage as any);
  const progress = Math.min(100, (Math.max(0, Math.min(left, windowSec)) / windowSec) * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="radar-dispatch-status">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Acompanhamento do despacho</p>
        <span className="text-xs text-muted-foreground">
          {Math.max(0, currentIndex + 1)}/{RADAR_STAGES.length}
        </span>
      </div>

      <ol className="space-y-1.5">
        {RADAR_STAGES.map((s, i) => {
          const done = currentIndex > i;
          const active = currentIndex === i;
          return (
            <li key={s} className="flex items-center gap-2 text-sm">
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              ) : active ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              )}
              <span className={active ? "font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/60"}>
                {RADAR_STAGE_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>

      {expiresAt && left > 0 && (
        <div className="space-y-1" data-testid="radar-countdown">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Aguardando resposta do profissional</span>
            <span>{left >= 60 ? `${Math.floor(left / 60)}min ${left % 60}s` : `${left}s`}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {(stage === "enroute" || stage === "arrived") && (
        <p className="text-xs text-muted-foreground">
          {remainingKm != null ? `${remainingKm.toFixed(1)} km restantes` : "Rota em andamento"}
          {etaMin != null ? ` · chega em ${etaMin} min` : ""}
        </p>
      )}
    </div>
  );
};

export default RadarDispatchStatus;
