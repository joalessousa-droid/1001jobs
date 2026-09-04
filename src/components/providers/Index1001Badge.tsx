import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  profileId: string;
  className?: string;
}

/** ÍNDICE 1001 — 0 a 100, derivado da reputação consolidada do profissional. */
const Index1001Badge = ({ profileId, className }: Props) => {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("reputation_scores")
        .select("weighted_score, total_reviews, dispute_rate")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (!alive || !data) return;
      const base = Math.min(5, Math.max(0, Number(data.weighted_score) || 0)) * 20;
      const penalty = Math.min(15, (Number(data.dispute_rate) || 0) * 100);
      setScore(Math.round(Math.max(0, base - penalty)));
    })();
    return () => {
      alive = false;
    };
  }, [profileId]);

  if (score === null) return null;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-primary/30 text-primary", className)}
      title="Índice 1001: avaliações, conclusão, disputas e recorrência"
      data-testid="index-1001"
    >
      <ShieldCheck className="w-3.5 h-3.5" />
      Índice 1001 · {score}/100
    </Badge>
  );
};

export default Index1001Badge;
