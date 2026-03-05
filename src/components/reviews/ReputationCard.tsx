import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Shield, TrendingUp, AlertTriangle, Award, Loader2 } from "lucide-react";

interface ReputationData {
  weighted_score: number;
  total_reviews: number;
  total_disputes: number;
  dispute_rate: number;
  badges: string[];
  score_breakdown: Record<string, number>;
}

const BADGE_MAP: Record<string, { label: string; icon: typeof Star; className: string }> = {
  top_rated: { label: "Top Rated", icon: Award, className: "bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30" },
  recomendado: { label: "Recomendado", icon: Star, className: "bg-primary/10 text-primary border-primary/30" },
  veterano: { label: "Veterano", icon: Shield, className: "bg-primary/10 text-primary border-primary/30" },
  experiente: { label: "Experiente", icon: TrendingUp, className: "bg-secondary text-secondary-foreground border-border" },
  ativo: { label: "Ativo", icon: TrendingUp, className: "bg-secondary text-secondary-foreground border-border" },
  zero_disputas: { label: "Zero Disputas", icon: Shield, className: "bg-primary/10 text-primary border-primary/30" },
  confiavel: { label: "Confiável", icon: Shield, className: "bg-primary/10 text-primary border-primary/30" },
};

interface Props {
  profileId: string;
  compact?: boolean;
}

const ReputationCard = ({ profileId, compact = false }: Props) => {
  const [data, setData] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("reputation_scores")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle()
      .then(({ data: rep }) => {
        if (rep) {
          setData({
            weighted_score: Number(rep.weighted_score),
            total_reviews: rep.total_reviews,
            total_disputes: rep.total_disputes,
            dispute_rate: Number(rep.dispute_rate),
            badges: (rep.badges as string[]) || [],
            score_breakdown: (rep.score_breakdown as Record<string, number>) || {},
          });
        }
        setLoading(false);
      });
  }, [profileId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  if (!data || data.total_reviews === 0) {
    if (compact) return null;
    return (
      <Card className="p-5 bg-card border-border text-center">
        <Star className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Sem avaliações ainda</p>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(data.weighted_score) ? "fill-[hsl(var(--gold))] text-[hsl(var(--gold))]" : "text-muted-foreground/30"}`} />
          ))}
        </div>
        <span className="text-sm font-medium text-foreground">{data.weighted_score.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">({data.total_reviews})</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 bg-card border-border text-center">
          <p className="text-2xl font-bold text-primary">{data.weighted_score.toFixed(1)}</p>
          <div className="flex justify-center gap-0.5 my-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(data.weighted_score) ? "fill-[hsl(var(--gold))] text-[hsl(var(--gold))]" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Reputação</p>
        </Card>
        <Card className="p-4 bg-card border-border text-center">
          <p className="text-2xl font-bold text-foreground">{data.total_reviews}</p>
          <p className="text-xs text-muted-foreground mt-1">Avaliações</p>
        </Card>
        <Card className="p-4 bg-card border-border text-center">
          <p className="text-2xl font-bold text-foreground">{data.total_disputes}</p>
          <p className="text-xs text-muted-foreground mt-1">Disputas</p>
        </Card>
        <Card className="p-4 bg-card border-border text-center">
          <p className={`text-2xl font-bold ${data.dispute_rate > 0.1 ? "text-destructive" : "text-primary"}`}>
            {(data.dispute_rate * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Taxa disputas</p>
        </Card>
      </div>

      {/* Badges */}
      {data.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.badges.map((b) => {
            const badge = BADGE_MAP[b];
            if (!badge) return null;
            const Icon = badge.icon;
            return (
              <Badge key={b} variant="outline" className={`gap-1.5 ${badge.className} border`}>
                <Icon className="w-3 h-3" />
                {badge.label}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Breakdown */}
      {data.score_breakdown.weighted_average && (
        <Card className="p-4 bg-card border-border">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Detalhamento</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Média ponderada</span>
              <span className="font-medium text-foreground">{data.score_breakdown.weighted_average}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penalidade disputas</span>
              <span className={`font-medium ${data.score_breakdown.dispute_penalty > 0 ? "text-destructive" : "text-primary"}`}>
                -{data.score_breakdown.dispute_penalty}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReputationCard;
