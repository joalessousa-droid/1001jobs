import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, MapPin, X, Send } from "lucide-react";
import type { RadarProfessional } from "@/hooks/useProfessionalRadar";

interface Props {
  professional: RadarProfessional | null;
  onClose: () => void;
  onRequest?: (p: RadarProfessional) => void;
  onViewProfile?: (p: RadarProfessional) => void;
  requesting?: boolean;
}

const RadarBottomDrawer = ({ professional, onClose, onRequest, onViewProfile, requesting }: Props) => (
  <div
    data-testid="radar-bottom-drawer"
    aria-hidden={!professional}
    className={`absolute inset-x-0 bottom-0 z-[600] transition-transform duration-300 ease-out ${
      professional ? "translate-y-0" : "translate-y-[110%]"
    }`}
  >
    {professional && (
      <div className="m-3 rounded-2xl border border-border bg-card/95 backdrop-blur p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center font-semibold">
            {professional.avatar_url ? (
              <img
                src={professional.avatar_url}
                alt={professional.display_name ?? "Profissional"}
                className="w-full h-full object-cover"
              />
            ) : (
              (professional.display_name ?? "?").charAt(0)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{professional.display_name ?? "Profissional"}</p>
              {professional.is_synthetic && (
                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">
                  demo
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-1">
              {professional.rating != null && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />
                  {Number(professional.rating).toFixed(1)}
                </span>
              )}
              {professional.category_name && <span>🛠 {professional.category_name}</span>}
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {professional.distance_km.toFixed(1)} km
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {professional.eta_min} min
              </span>
              {professional.match_score != null && (
                <Badge variant="secondary" className="text-[10px]">
                  match {Number(professional.match_score).toFixed(0)}
                </Badge>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            className="flex-1"
            disabled={requesting}
            onClick={() => onRequest?.(professional)}
          >
            <Send className="w-4 h-4 mr-2" /> Solicitar agora
          </Button>
          <Button variant="outline" onClick={() => onViewProfile?.(professional)}>
            Ver perfil
          </Button>
        </div>
      </div>
    )}
  </div>
);

export default RadarBottomDrawer;
