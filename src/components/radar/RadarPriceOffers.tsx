import { Badge } from "@/components/ui/badge";
import { Loader2, Star, ShieldCheck, Briefcase, CalendarPlus } from "lucide-react";
import type { RadarQuote, RadarProfessional } from "@/hooks/useProfessionalRadar";
import type { ProviderReputation } from "@/hooks/useProviderReputation";
import MatchExplanation from "./MatchExplanation";

interface Props {
  quotes: RadarQuote[];
  professionals: RadarProfessional[];
  /** preços reais praticados (provider_services.hourly_rate) por provider_id */
  rates?: Record<string, number>;
  /** resumo de reputação por provider_id */
  reputation?: Record<string, ProviderReputation>;
  waiting?: boolean;
  accepting?: string | null;
  onAccept: (q: RadarQuote) => void;
  /** agendar atendimento com o profissional da oferta */
  onSchedule?: (q: RadarQuote) => void;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const RadarPriceOffers = ({
  quotes,
  professionals,
  rates = {},
  reputation = {},
  waiting,
  accepting,
  onAccept,
  onSchedule,
}: Props) => {
  const quotedIds = new Set(quotes.map((q) => q.provider_id));
  const realRates = professionals
    .filter((p) => !quotedIds.has(p.provider_id) && rates[p.provider_id] > 0)
    .sort((a, b) => rates[a.provider_id] - rates[b.provider_id])
    .slice(0, 4);

  if (!waiting && quotes.length === 0 && realRates.length === 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[650] p-3 space-y-2" data-testid="radar-price-offers">
      {waiting && quotes.length === 0 && (
        <div className="rounded-xl border border-border bg-card/95 backdrop-blur px-4 py-3 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Aguardando os profissionais enviarem o preço do serviço…
        </div>
      )}

      <div className="space-y-2 max-h-[46vh] overflow-auto">
        {quotes.map((q) => {
          const p = professionals.find((x) => x.provider_id === q.provider_id);
          const busy = accepting === q.offer_id;
          return (
            <div
              key={q.offer_id}
              className="rounded-xl border border-border bg-card/95 backdrop-blur shadow-xl p-3 space-y-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0">
                  {p?.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (p?.display_name ?? "?").charAt(0)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="block text-sm font-semibold truncate">
                      {p?.display_name ?? "Profissional"}
                    </span>
                    {q.simulated && <Badge className="text-[10px]">bot</Badge>}
                  </div>
                  <span className="block text-[11px] text-muted-foreground">
                    {q.distance_km != null || p ? `${(q.distance_km ?? p?.distance_km ?? 0).toFixed(1)} km` : ""}
                    {p ? ` · ${p.eta_min} min` : ""}
                    {q.simulated ? " · demo" : ""}
                  </span>
                  {(() => {
                    const rep =
                      reputation[q.provider_id] ??
                      ((p as any)?.reputation
                        ? {
                            rating: (p as any).reputation.rating,
                            total_reviews: (p as any).reputation.total_reviews,
                            total_services: (p as any).reputation.total_reviews,
                            verified: (p as any).reputation.verified,
                          }
                        : null);
                    const rating = rep?.rating ?? p?.rating ?? null;
                    return (
                      <span
                        className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground"
                        data-testid="radar-offer-reputation"
                      >
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-current" />
                          {rating != null ? Number(rating).toFixed(1) : "novo"}
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <Briefcase className="w-3 h-3" />
                          {rep?.total_services ?? 0} serviços
                        </span>
                        {rep?.verified && (
                          <span className="inline-flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> verificado
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  <MatchExplanation
                    quote={q}
                    professional={p ?? null}
                    reputation={reputation[q.provider_id] ?? null}
                  />
                </div>
              </div>

              {/* Ordem da solicitação: 1) agendar  2) preço  3) aceitar */}
              <div className="flex items-center gap-2">
                {onSchedule && (
                  <button
                    type="button"
                    onClick={() => onSchedule(q)}
                    title="Agendar atendimento"
                    aria-label="Agendar atendimento"
                    data-testid="radar-schedule-offer"
                    className="shrink-0 h-11 px-3 rounded-xl border border-border bg-background text-foreground flex items-center gap-2 text-sm hover:bg-muted transition-colors"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Agendar</span>
                  </button>
                )}
                <div className="flex-1 min-w-0 text-right sm:text-left">
                  <p className="text-[11px] text-muted-foreground leading-none">Preço proposto</p>
                  <p className="text-base font-bold leading-tight" data-testid="radar-offer-price">
                    {brl(q.price)}
                  </p>
                </div>
                <button
                  onClick={() => onAccept(q)}
                  disabled={!!accepting}
                  data-testid="radar-accept-price"
                  className="shrink-0 h-11 px-4 rounded-xl bg-[hsl(190_85%_45%)] hover:bg-[hsl(190_85%_40%)] disabled:opacity-70 text-white font-semibold text-sm transition-colors flex items-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceitar"}
                </button>
              </div>
            </div>
          );

        })}
        {realRates.length > 0 && (
          <div className="rounded-xl border border-border bg-card/95 backdrop-blur p-3 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Preços reais praticados
            </p>
            {realRates.map((p) => (
              <div key={p.provider_id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {p.display_name ?? "Profissional"}
                  <span className="text-muted-foreground"> · {p.distance_km.toFixed(1)} km</span>
                </span>
                <span className="font-semibold">{brl(rates[p.provider_id])}/h</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Valor de referência — o preço final chega como oferta do profissional.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RadarPriceOffers;
