import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { RadarQuote, RadarProfessional } from "@/hooks/useProfessionalRadar";
import type { ProviderReputation } from "@/hooks/useProviderReputation";

interface Props {
  quote: RadarQuote;
  professional?: RadarProfessional | null;
  reputation?: ProviderReputation | null;
}

/** #14 — A IA explica por que recomenda o profissional (sem expor o score interno). */
const MatchExplanation = ({ quote, professional, reputation }: Props) => {
  const [open, setOpen] = useState(false);
  const p = professional ?? null;
  const rep = reputation ?? (p as any)?.reputation ?? null;
  const rating = rep?.rating ?? p?.rating ?? null;
  const services = rep?.total_services ?? rep?.total_reviews ?? 0;
  const distance = quote.distance_km ?? p?.distance_km ?? null;
  const eta = p?.eta_min ?? null;

  const reasons: string[] = [];
  if (distance != null) reasons.push(`Está a ${distance.toFixed(1)} km de você`);
  if (eta != null) reasons.push(`Pode chegar em aproximadamente ${eta} minutos`);
  if (rating != null) reasons.push(`Nota média ${Number(rating).toFixed(1)}`);
  if (services > 0) reasons.push(`Já realizou ${services} serviços`);
  if (rep?.verified) reasons.push("Perfil verificado pela 1001Jobs");

  if (reasons.length === 0) return null;

  return (
    <div className="mt-1" data-testid="match-explanation">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] underline-offset-2 hover:underline opacity-90"
      >
        <Sparkles className="w-3 h-3" />
        Por que recomendamos?
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 text-[11px] opacity-95">
          {reasons.map((r) => (
            <li key={r} className="flex items-start gap-1">
              <span aria-hidden>✓</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MatchExplanation;
