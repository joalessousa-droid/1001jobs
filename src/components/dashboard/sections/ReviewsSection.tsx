import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Star, Loader2 } from "lucide-react";
import PendingReviews from "@/components/reviews/PendingReviews";
import EnhancedReviewList from "@/components/reviews/EnhancedReviewList";

interface Props {
  profileId: string;
}

const ReviewsSection = ({ profileId }: Props) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-display">Avaliações</h2>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas avaliações e reputação</p>
      </div>

      {/* Pending reviews to submit */}
      <PendingReviews profileId={profileId} />

      {/* Received reviews with reputation */}
      <EnhancedReviewList profileId={profileId} showReputation={true} />
    </div>
  );
};

export default ReviewsSection;
