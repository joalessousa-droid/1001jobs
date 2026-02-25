import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StarRating from "./StarRating";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

interface ReviewFormProps {
  reviewedProfileId: string;
  existingReview?: { id: string; rating: number; comment: string | null } | null;
  onReviewSubmitted: () => void;
}

const ReviewForm = ({ reviewedProfileId, existingReview, onReviewSubmitted }: ReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || "");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Selecione uma nota", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Get current user's profile id
    const { data: profileData } = await supabase.rpc("get_my_profile_id");
    if (!profileData) {
      toast({ title: "Erro ao obter perfil", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (profileData === reviewedProfileId) {
      toast({ title: "Você não pode avaliar a si mesmo", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (existingReview) {
      const { error } = await supabase
        .from("reviews")
        .update({ rating, comment: comment || null })
        .eq("id", existingReview.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Avaliação atualizada!" });
        onReviewSubmitted();
      }
    } else {
      const { error } = await supabase
        .from("reviews")
        .insert({
          reviewer_id: profileData,
          reviewed_id: reviewedProfileId,
          rating,
          comment: comment || null,
        });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Você já avaliou este profissional", variant: "destructive" });
        } else {
          toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Avaliação enviada!" });
        onReviewSubmitted();
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <p className="text-sm font-medium text-foreground">
        {existingReview ? "Editar sua avaliação" : "Deixe sua avaliação"}
      </p>
      <StarRating rating={rating} onRate={setRating} size="md" />
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escreva um comentário (opcional)..."
        className="bg-background border-border min-h-[80px]"
        maxLength={500}
      />
      <Button
        onClick={handleSubmit}
        disabled={loading || rating === 0}
        size="sm"
        className="gap-2"
      >
        <Send className="w-3.5 h-3.5" />
        {loading ? "Enviando..." : existingReview ? "Atualizar" : "Enviar avaliação"}
      </Button>
    </div>
  );
};

export default ReviewForm;
