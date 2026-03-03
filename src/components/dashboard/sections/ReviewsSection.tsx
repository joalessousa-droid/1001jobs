import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Star, Loader2 } from "lucide-react";

interface Props {
  profileId: string;
}

const ReviewsSection = ({ profileId }: Props) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, reviewer:profiles!reviews_reviewer_id_fkey(display_name, avatar_url)")
        .eq("reviewed_id", profileId)
        .order("created_at", { ascending: false });
      setReviews(data || []);
      setLoading(false);
    };
    fetch();
  }, [profileId]);

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0.0";

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Avaliações</h2>
        <p className="text-muted-foreground text-sm mt-1">Veja o que dizem sobre você</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 bg-card border-border text-center">
          <p className="text-3xl font-bold text-primary">{avg}</p>
          <div className="flex justify-center gap-0.5 my-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`w-4 h-4 ${i <= Math.round(Number(avg)) ? "text-[hsl(var(--gold))] fill-[hsl(var(--gold))]" : "text-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Média geral</p>
        </Card>
        <Card className="p-5 bg-card border-border text-center">
          <p className="text-3xl font-bold text-foreground">{reviews.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total de avaliações</p>
        </Card>
      </div>

      {reviews.length === 0 ? (
        <Card className="p-8 bg-card border-border text-center">
          <Star className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma avaliação recebida</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className="p-4 bg-card border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.reviewer?.display_name || "Usuário"}</p>
                  <div className="flex gap-0.5 my-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-3 h-3 ${i <= r.rating ? "text-[hsl(var(--gold))] fill-[hsl(var(--gold))]" : "text-muted"}`} />
                    ))}
                  </div>
                  {r.comment && <p className="text-xs text-muted-foreground mt-1">{r.comment}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewsSection;
