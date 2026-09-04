import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { useMarketPrice } from "@/hooks/useMarketPrice";
import { CONFIDENCE_LABEL, GEO_LEVEL_LABEL, formatBRL } from "@/lib/ai1001Learning";

interface Props {
  category: string;
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  urgency?: string | null;
  complexity?: string | null;
  /** 43 = visão simples do cliente | 44 = visão do profissional */
  audience?: "client" | "provider";
  className?: string;
}

/**
 * 43/44 — Estimativa 1001 para o cliente e referência de preço para o profissional.
 * Nunca expõe dados individuais de concorrentes, apenas agregados.
 */
const MarketPriceCard = ({
  category,
  state,
  city,
  neighborhood,
  urgency,
  complexity,
  audience = "client",
  className,
}: Props) => {
  const { marketPrice, loading } = useMarketPrice({
    category,
    state,
    city,
    neighborhood,
    urgency,
    complexity,
  });

  if (loading || !marketPrice) return null;

  if (!marketPrice.available) {
    return (
      <Card className={`p-4 ${className ?? ""}`} data-testid="market-price-card">
        <p className="text-sm text-muted-foreground">
          Ainda não temos dados suficientes para estimar este serviço com precisão na sua região.
        </p>
      </Card>
    );
  }

  const TrendIcon =
    marketPrice.trend_direction === "alta"
      ? TrendingUp
      : marketPrice.trend_direction === "baixa"
        ? TrendingDown
        : Minus;

  return (
    <Card className={`p-4 space-y-2 ${className ?? ""}`} data-testid="market-price-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          {audience === "client" ? "Estimativa 1001" : "Preço praticado na sua região"}
        </p>
        <Badge variant="secondary" data-testid="market-price-confidence">
          {CONFIDENCE_LABEL[marketPrice.confidence]}
        </Badge>
      </div>

      <p className="text-xl font-semibold" data-testid="market-price-range">
        {formatBRL(marketPrice.range_min)} – {formatBRL(marketPrice.range_max)}
      </p>

      {audience === "provider" && (
        <p className="text-sm text-muted-foreground">
          Mediana: <span className="font-medium text-foreground">{formatBRL(marketPrice.median)}</span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Baseada em serviços semelhantes em {GEO_LEVEL_LABEL[marketPrice.level_used]}
        {marketPrice.sample_size ? ` (${marketPrice.sample_size} atendimentos)` : ""}.
      </p>

      {audience === "provider" && marketPrice.trend_direction && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <TrendIcon className="h-3.5 w-3.5" />
          Tendência {marketPrice.trend_direction} nos últimos 30 dias
        </p>
      )}
    </Card>
  );
};

export default MarketPriceCard;
