import { MapPin, Star, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ProviderListCardProps {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  verified: boolean;
  primarySpecialty?: string;
  distanceKm?: number;
  availableToday?: boolean;
  servicesDone?: number;
  startingPrice?: number;
  avgRating?: number;
  reviewCount?: number;
  selected: boolean;
  onSelect: () => void;
}

const ProviderListCard = ({
  displayName,
  avatarUrl,
  city,
  state,
  verified,
  primarySpecialty,
  distanceKm,
  availableToday,
  servicesDone,
  startingPrice,
  avgRating,
  reviewCount,
  selected,
  onSelect,
}: ProviderListCardProps) => {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border bg-card p-4 transition-all",
        "hover:border-primary/40 hover:shadow-md",
        selected
          ? "border-primary ring-2 ring-primary/30 shadow-md"
          : "border-border"
      )}
    >
      <div className="flex gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-base font-bold text-muted-foreground font-display">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
            {verified && <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#2563EB" }} />}
          </div>
          {avgRating !== undefined && avgRating > 0 ? (
            <div className="flex items-center gap-1 text-xs mt-0.5">
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              <span className="font-medium text-foreground">{avgRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({reviewCount || 0})</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-0.5">Sem avaliações ainda</div>
          )}
          {primarySpecialty && (
            <p className="text-sm text-foreground/80 mt-1 truncate">{primarySpecialty}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground">
        {distanceKm !== undefined && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {distanceKm.toFixed(1)} km
          </span>
        )}
        {!distanceKm && (city || state) && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {[city, state].filter(Boolean).join(", ")}
          </span>
        )}
        {availableToday && (
          <span className="flex items-center gap-1 text-emerald-500 font-medium">
            <Clock className="w-3 h-3" />
            Disponível hoje
          </span>
        )}
        {servicesDone !== undefined && servicesDone > 0 && (
          <span>{servicesDone} serviços realizados</span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <div>
          {startingPrice !== undefined ? (
            <div>
              <span className="text-xs text-muted-foreground">A partir de </span>
              <span className="text-sm font-bold text-foreground">R$ {startingPrice.toFixed(0)}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sob consulta</span>
          )}
        </div>
        <Button size="sm" variant={selected ? "default" : "outline"} className="text-xs h-8" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          {selected ? "Selecionado" : "Selecionar"}
        </Button>
      </div>
    </button>
  );
};

export default ProviderListCard;
