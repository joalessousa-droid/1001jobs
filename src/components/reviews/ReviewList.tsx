import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StarRating from "./StarRating";
import ReviewForm from "./ReviewForm";
import { MessageSquare } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
}

interface ReviewListProps {
  profileId: string;
}

const ReviewList = ({ profileId }: ReviewListProps) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id, profiles!reviews_reviewer_id_fkey(display_name, avatar_url)")
      .eq("reviewed_id", profileId)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped: Review[] = data.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_id: r.reviewer_id,
        reviewer_name: r.profiles?.display_name || "Anônimo",
        reviewer_avatar: r.profiles?.avatar_url || null,
      }));
      setReviews(mapped);
      if (mapped.length > 0) {
        setAvgRating(mapped.reduce((sum, r) => sum + r.rating, 0) / mapped.length);
      } else {
        setAvgRating(0);
      }
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (user) {
      supabase.rpc("get_my_profile_id").then(({ data }) => {
        if (data) {
          setMyProfileId(data);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (myProfileId && reviews.length > 0) {
      setMyReview(reviews.find((r) => r.reviewer_id === myProfileId) || null);
    }
  }, [myProfileId, reviews]);

  const canReview = user && myProfileId && myProfileId !== profileId;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h3 className="font-display font-bold text-lg text-foreground">Avaliações</h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={Math.round(avgRating)} />
            <span className="text-sm text-muted-foreground">
              {avgRating.toFixed(1)} ({reviews.length})
            </span>
          </div>
        )}
      </div>

      {canReview && (
        <ReviewForm
          reviewedProfileId={profileId}
          existingReview={myReview}
          onReviewSubmitted={fetchReviews}
        />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="p-4 rounded-xl border border-border bg-card/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {review.reviewer_avatar ? (
                    <img src={review.reviewer_avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">
                      {review.reviewer_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{review.reviewer_name}</p>
                  <StarRating rating={review.rating} />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(review.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {review.comment && (
                <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewList;
