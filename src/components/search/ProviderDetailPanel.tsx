import { useNavigate } from "react-router-dom";
import { CheckCircle, MapPin, Star, MessageCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MarketPriceCard from "@/components/ai/MarketPriceCard";
import SearchMap from "@/components/search/SearchMap";
import ShareButton from "@/components/search/ShareButton";

interface ProviderDetailPanelProps {
  id: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  avatarUrl: string | null;
  verified: boolean;
  services: { categoryName: string; hourlyRate: number | null }[];
  avgRating?: number;
  reviewCount?: number;
  latitude: number | null;
  longitude: number | null;
}

const ProviderDetailPanel = (props: ProviderDetailPanelProps) => {
  const navigate = useNavigate();
  const { id, displayName, bio, city, state, avatarUrl, verified, services, avgRating, reviewCount, latitude, longitude } = props;
  const minRate = services.map((s) => s.hourlyRate).filter((r): r is number => r != null).sort((a, b) => a - b)[0];

  return (
    <div className="flex flex-col h-full">
      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground font-display">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-display font-bold text-foreground truncate">{displayName}</h2>
              {verified && <CheckCircle className="w-5 h-5 shrink-0" style={{ color: "#2563EB" }} />}
              <ShareButton url={`/provider/${id}`} title={displayName} text={`Confira o perfil de ${displayName}`} />
            </div>
            {avgRating !== undefined && avgRating > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({reviewCount || 0} avaliações)</span>
              </div>
            )}
            {(city || state) && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {[city, state].filter(Boolean).join(", ")}
              </p>
            )}
            {minRate !== undefined && (
              <p className="text-sm mt-1">
                <span className="text-muted-foreground">A partir de </span>
                <span className="font-bold text-foreground">R$ {minRate.toFixed(0)}/h</span>
              </p>
            )}
          </div>
        </div>

        {bio && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Sobre</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{bio}</p>
          </div>
        )}

        {services.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Serviços que realiza</h3>
            <div className="flex flex-wrap gap-1.5">
              {services.map((s, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {s.categoryName}
                  {s.hourlyRate ? ` · R$ ${s.hourlyRate.toFixed(0)}/h` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {services[0]?.categoryName && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Faixa praticada na região</h3>
            <MarketPriceCard
              category={services[0].categoryName}
              city={city}
              state={state}
              audience="client"
            />
          </div>
        )}

        {latitude != null && longitude != null && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Localização aproximada</h3>
            <SearchMap
              markers={[{ id, lat: latitude, lng: longitude, name: displayName, type: "provider" }]}
              center={[latitude, longitude]}
              radius={0}
              className="h-48 rounded-xl border border-border overflow-hidden"
            />
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            Próximos horários disponíveis
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {["Hoje · 14h", "Hoje · 17h", "Amanhã · 10h"].map((slot) => (
              <div key={slot} className="text-xs text-center bg-muted rounded-lg py-2 text-muted-foreground">
                {slot}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Disponibilidade confirmada na contratação.</p>
        </div>
      </div>

      {/* sticky footer action */}
      <div className="border-t border-border p-4 bg-card flex flex-col sm:flex-row gap-2">
        <Button variant="outline" className="flex-1 gap-1.5" onClick={() => navigate(`/provider/${id}`)}>
          <MessageCircle className="w-4 h-4" />
          Ver perfil completo
        </Button>
        <Button className="flex-1 gap-1.5" onClick={() => navigate(`/provider/${id}`)}>
          Contratar agora
        </Button>
      </div>
    </div>
  );
};

export default ProviderDetailPanel;
