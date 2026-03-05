import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StarRating from "./StarRating";
import DisputeForm from "./DisputeForm";
import ReputationCard from "./ReputationCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Flag, Clock, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  review_type: string;
  is_published: boolean;
  is_contested: boolean;
  subcriteria: { criterion: string; score: number }[];
  evidence: { file_url: string; file_name: string | null }[];
}

interface Props {
  profileId: string;
  showReputation?: boolean;
}

const CRITERION_LABELS: Record<string, string> = {
  pontualidade: "Pontualidade",
  qualidade: "Qualidade",
  comunicacao: "Comunicação",
  profissionalismo: "Profissionalismo",
  custo_beneficio: "Custo-benefício",
  respeito: "Respeito",
  clareza: "Clareza",
  pagamento: "Pagamento",
};

const EnhancedReviewList = ({ profileId, showReputation = true }: Props) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [disputeReviewId, setDisputeReviewId] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase
      .from("reviews")
      .select(`
        id, rating, comment, created_at, reviewer_id, review_type, is_published, is_contested,
        profiles!reviews_reviewer_id_fkey(display_name, avatar_url),
        review_subcriteria(criterion, score),
        review_evidence(file_url, file_name)
      `)
      .eq("reviewed_id", profileId)
      .eq("is_published", true)
      .eq("is_shadow", false)
      .order("created_at", { ascending: false });

    if (data) {
      setReviews(
        data.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          reviewer_id: r.reviewer_id,
          reviewer_name: r.profiles?.display_name || "Anônimo",
          reviewer_avatar: r.profiles?.avatar_url || null,
          review_type: r.review_type,
          is_published: r.is_published,
          is_contested: r.is_contested,
          subcriteria: r.review_subcriteria || [],
          evidence: r.review_evidence || [],
        }))
      );
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (user) {
      supabase.rpc("get_my_profile_id").then(({ data }) => {
        if (data) setMyProfileId(data);
      });
    }
  }, [user]);

  const canDispute = (review: Review) => {
    return myProfileId && myProfileId === profileId && !review.is_contested;
  };

  return (
    <div className="space-y-6">
      {showReputation && <ReputationCard profileId={profileId} />}

      <h3 className="font-display font-bold text-lg text-foreground">Avaliações recebidas</h3>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma avaliação publicada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const isExpanded = expandedReview === review.id;
            return (
              <Card key={review.id} className="p-4 bg-card border-border">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {review.reviewer_avatar ? (
                      <img src={review.reviewer_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">
                        {review.reviewer_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{review.reviewer_name}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {review.review_type === "client_to_provider" ? "Cliente" : "Profissional"}
                      </Badge>
                      {review.is_contested && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/30 text-destructive">
                          Contestada
                        </Badge>
                      )}
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(review.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                {/* Comment */}
                {review.comment && (
                  <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                )}

                {/* Expand toggle */}
                {(review.subcriteria.length > 0 || review.evidence.length > 0) && (
                  <button
                    onClick={() => setExpandedReview(isExpanded ? null : review.id)}
                    className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? "Menos detalhes" : "Ver detalhes"}
                  </button>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    {/* Subcriteria */}
                    {review.subcriteria.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {review.subcriteria.map((sc) => (
                          <div key={sc.criterion} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{CRITERION_LABELS[sc.criterion] || sc.criterion}</span>
                            <StarRating rating={sc.score} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Evidence */}
                    {review.evidence.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {review.evidence.map((e, i) => (
                          <a
                            key={i}
                            href={e.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg text-xs text-primary hover:underline"
                          >
                            <ImageIcon className="w-3 h-3" />
                            {e.file_name?.slice(0, 20) || `Evidência ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Dispute button */}
                {canDispute(review) && (
                  <div className="mt-3 border-t border-border pt-3">
                    {disputeReviewId === review.id ? (
                      <DisputeForm
                        reviewId={review.id}
                        onSubmitted={() => { setDisputeReviewId(null); fetchReviews(); }}
                        onCancel={() => setDisputeReviewId(null)}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisputeReviewId(review.id)}
                        className="text-xs text-muted-foreground gap-1.5"
                      >
                        <Flag className="w-3 h-3" />
                        Contestar
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EnhancedReviewList;
