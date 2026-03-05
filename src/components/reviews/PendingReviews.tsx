import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle } from "lucide-react";
import BidirectionalReviewForm from "./BidirectionalReviewForm";

interface PendingService {
  id: string;
  completed_at: string;
  other_profile_id: string;
  other_name: string;
  review_type: "client_to_provider" | "provider_to_client";
  already_reviewed: boolean;
  peer_reviewed: boolean;
}

interface Props {
  profileId: string;
}

const PendingReviews = ({ profileId }: Props) => {
  const [pending, setPending] = useState<PendingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<string | null>(null);

  const fetchPending = async () => {
    // Get completed services where this profile is involved
    const { data: asClient } = await supabase
      .from("completed_services")
      .select("id, completed_at, provider_id, profiles!completed_services_provider_id_fkey(display_name)")
      .eq("client_id", profileId)
      .eq("status", "completed");

    const { data: asProvider } = await supabase
      .from("completed_services")
      .select("id, completed_at, client_id, profiles!completed_services_client_id_fkey(display_name)")
      .eq("provider_id", profileId)
      .eq("status", "completed");

    // Check which ones already have reviews from this user
    const { data: myReviews } = await supabase
      .from("reviews")
      .select("completed_service_id")
      .eq("reviewer_id", profileId)
      .not("completed_service_id", "is", null);

    const reviewedServiceIds = new Set((myReviews || []).map((r) => r.completed_service_id));

    // Check which have peer reviews
    const { data: peerReviews } = await supabase
      .from("reviews")
      .select("completed_service_id")
      .eq("reviewed_id", profileId)
      .not("completed_service_id", "is", null);

    const peerReviewedIds = new Set((peerReviews || []).map((r) => r.completed_service_id));

    const items: PendingService[] = [];

    for (const s of asClient || []) {
      items.push({
        id: s.id,
        completed_at: s.completed_at,
        other_profile_id: s.provider_id,
        other_name: (s as any).profiles?.display_name || "Profissional",
        review_type: "client_to_provider",
        already_reviewed: reviewedServiceIds.has(s.id),
        peer_reviewed: peerReviewedIds.has(s.id),
      });
    }

    for (const s of asProvider || []) {
      items.push({
        id: s.id,
        completed_at: s.completed_at,
        other_profile_id: s.client_id,
        other_name: (s as any).profiles?.display_name || "Cliente",
        review_type: "provider_to_client",
        already_reviewed: reviewedServiceIds.has(s.id),
        peer_reviewed: peerReviewedIds.has(s.id),
      });
    }

    // Sort: pending first, then by date
    items.sort((a, b) => {
      if (a.already_reviewed !== b.already_reviewed) return a.already_reviewed ? 1 : -1;
      return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
    });

    setPending(items);
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, [profileId]);

  if (loading) return null;
  if (pending.length === 0) return null;

  const pendingCount = pending.filter((p) => !p.already_reviewed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-display font-bold text-lg text-foreground">Avaliações pendentes</h3>
        {pendingCount > 0 && (
          <Badge className="bg-primary/10 text-primary border-primary/30 border">{pendingCount}</Badge>
        )}
      </div>

      <div className="space-y-3">
        {pending.filter((p) => !p.already_reviewed).map((service) => (
          <Card key={service.id} className="p-4 bg-card border-border">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{service.other_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Concluído em {new Date(service.completed_at).toLocaleDateString("pt-BR")}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {service.review_type === "client_to_provider" ? "Avaliar profissional" : "Avaliar cliente"}
                  </Badge>
                  {service.peer_reviewed && (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      <CheckCircle className="w-2.5 h-2.5 mr-1" />
                      Outra parte já avaliou
                    </Badge>
                  )}
                </div>
              </div>
              {activeForm !== service.id && (
                <button
                  onClick={() => setActiveForm(service.id)}
                  className="text-xs text-primary font-medium hover:underline shrink-0"
                >
                  Avaliar agora
                </button>
              )}
            </div>

            {activeForm === service.id && (
              <div className="mt-4">
                <BidirectionalReviewForm
                  completedServiceId={service.id}
                  reviewedProfileId={service.other_profile_id}
                  reviewType={service.review_type}
                  onSubmitted={() => {
                    setActiveForm(null);
                    fetchPending();
                  }}
                />
              </div>
            )}
          </Card>
        ))}

        {/* Already reviewed */}
        {pending.filter((p) => p.already_reviewed).length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Já avaliados</p>
            {pending.filter((p) => p.already_reviewed).map((service) => (
              <Card key={service.id} className="p-3 bg-card/50 border-border mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm text-foreground">{service.other_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(service.completed_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingReviews;
