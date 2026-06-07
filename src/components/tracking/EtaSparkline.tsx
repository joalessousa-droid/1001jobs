import { useMemo } from "react";
import type { EtaHistoryEntry } from "@/lib/etaHistory";

interface Props {
  history: EtaHistoryEntry[] | null | undefined;
  width?: number;
  height?: number;
  limit?: number;
}

/**
 * Lightweight inline-SVG sparkline of ETA (seconds) over time.
 * Renders dots for each recalculation event and a delta label.
 * No external chart library; uses semantic CSS variables only.
 */
const EtaSparkline = ({ history, width = 240, height = 56, limit = 20 }: Props) => {
  const data = useMemo(() => {
    if (!Array.isArray(history)) return [];
    return history
      .filter((e) => e && Number.isFinite(e.eta_seconds) && typeof e.at === "string")
      .slice(-limit);
  }, [history, limit]);

  if (data.length < 2) {
    return (
      <div className="text-[11px] text-muted-foreground py-2">
        Aguardando amostras suficientes para o gráfico…
      </div>
    );
  }

  const values = data.map((d) => d.eta_seconds);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const stepX = (width - 8) / (data.length - 1);

  const points = data.map((d, i) => {
    const x = 4 + i * stepX;
    const y = height - 6 - ((d.eta_seconds - min) / span) * (height - 14);
    return { x, y, v: d.eta_seconds, at: d.at };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${height - 2} L${points[0].x.toFixed(1)},${height - 2} Z`;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = last.v - prev.v;
  const deltaMin = Math.round(delta / 60);
  const deltaLabel = Math.abs(delta) < 30
    ? "estável"
    : `${delta > 0 ? "+" : "−"}${Math.abs(deltaMin) || Math.round(Math.abs(delta))}${Math.abs(deltaMin) ? " min" : "s"}`;
  const deltaColor =
    delta > 30 ? "text-destructive" : delta < -30 ? "text-green-500" : "text-muted-foreground";

  return (
    <div className="space-y-1.5" role="img" aria-label="Evolução do ETA">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Evolução nos últimos {data.length} cálculos</span>
        <span className={`font-semibold tabular-nums ${deltaColor}`}>Δ {deltaLabel}</span>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block">
        <path d={area} fill="hsl(var(--primary) / 0.12)" />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={p.at + i}
            cx={p.x} cy={p.y} r={i === points.length - 1 ? 2.5 : 1.5}
            fill={i === points.length - 1 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.6)"}
          >
            <title>{`${new Date(p.at).toLocaleTimeString()} — ${Math.round(p.v / 60)} min`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
};

export default EtaSparkline;
