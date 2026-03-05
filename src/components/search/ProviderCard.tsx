import { MapPin, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import StarRating from "@/components/reviews/StarRating";
import { useTranslation } from "react-i18next";
import MatchBadge from "@/components/search/MatchBadge";
import ShareButton from "@/components/search/ShareButton";

interface ProviderCardProps {
  id: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  avatarUrl: string | null;
  verificationStatus: string;
  services: { categoryName: string; hourlyRate: number | null }[];
  avgRating?: number;
  reviewCount?: number;
  matchScore?: number;
  matchReasons?: string[];
}

const ProviderCard = ({
  id, displayName, bio, city, state, avatarUrl, verificationStatus, services, avgRating, reviewCount, matchScore, matchReasons,
}: ProviderCardProps) => {
  const { t } = useTranslation();
  const minRate = services.map((s) => s.hourlyRate).filter((r): r is number => r !== null).sort((a, b) => a - b)[0];

  return (
    <div className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 relative">
      <div className="absolute top-3 right-3">
        <ShareButton url={`/provider/${id}`} title={displayName} text={`Confira o perfil de ${displayName} - ${services.map(s => s.categoryName).join(", ")}`} />
      </div>
      <div className="flex gap-4">
        <div className="h-14 w-14 shrink-0 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-muted-foreground font-display">{displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-foreground truncate">{displayName}</h3>
            {verificationStatus === "verified" && (
              <CheckCircle className="w-5 h-5 shrink-0 text-[hsl(var(--gold))] fill-[hsl(var(--gold))/0.2]" />
            )}
            {matchScore !== undefined && matchScore > 0 && (
              <MatchBadge score={matchScore} reasons={matchReasons} />
            )}
          </div>
          {(city || state) && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3" />
              {[city, state].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      {bio && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{bio}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {services.slice(0, 3).map((s, i) => (
          <Badge key={i} variant="outline" className="text-xs border-border text-muted-foreground">{s.categoryName}</Badge>
        ))}
        {services.length > 3 && (
          <Badge variant="outline" className="text-xs border-border text-muted-foreground">+{services.length - 3}</Badge>
        )}
      </div>

      {avgRating !== undefined && avgRating > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          <StarRating rating={Math.round(avgRating)} />
          <span className="text-xs text-muted-foreground">{avgRating.toFixed(1)} ({reviewCount || 0})</span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {minRate !== undefined ? (
          <span className="text-sm font-semibold text-foreground">
            R$ {minRate.toFixed(0)}<span className="text-muted-foreground font-normal">/h</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{t("search.onConsultation")}</span>
        )}
        <Link to={`/provider/${id}`} className="text-sm font-medium text-primary hover:underline">
          {t("search.viewProfile")}
        </Link>
      </div>
    </div>
  );
};

export default ProviderCard;
