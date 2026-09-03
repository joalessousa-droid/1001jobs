import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { RadarQuote, RadarProfessional } from "@/hooks/useProfessionalRadar";

interface Props {
  quotes: RadarQuote[];
  professionals: RadarProfessional[];
  waiting?: boolean;
  accepting?: string | null;
  onAccept: (q: RadarQuote) => void;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const RadarPriceOffers = ({ quotes, professionals, waiting, accepting, onAccept }: Props) => {
  if (!waiting && quotes.length === 0) return null;

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
            <button
              key={q.offer_id}
              onClick={() => onAccept(q)}
              disabled={!!accepting}
              data-testid="radar-accept-price"
              className="w-full rounded-xl bg-[hsl(190_85%_45%)] hover:bg-[hsl(190_85%_40%)] disabled:opacity-70 text-white shadow-xl transition-colors px-4 py-3 flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-3 min-w-0 text-left">
                <span className="w-9 h-9 rounded-full bg-white/20 overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0">
                  {p?.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (p?.display_name ?? "?").charAt(0)
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">
                    {p?.display_name ?? "Profissional"}
                  </span>
                  <span className="block text-[11px] opacity-90">
                    {q.distance_km != null || p ? `${(q.distance_km ?? p?.distance_km ?? 0).toFixed(1)} km` : ""}
                    {p ? ` · ${p.eta_min} min` : ""}
                    {q.simulated ? " · demo" : ""}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {q.simulated && (
                  <Badge className="bg-white/20 text-white hover:bg-white/20 text-[10px]">bot</Badge>
                )}
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="text-base font-bold">Aceitar · {brl(q.price)}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RadarPriceOffers;
