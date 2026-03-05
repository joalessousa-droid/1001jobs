import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import StarRating from "./StarRating";
import { useToast } from "@/hooks/use-toast";
import { Send, Upload, X } from "lucide-react";

const SUBCRITERIA_CLIENT_TO_PROVIDER = [
  { key: "pontualidade", label: "Pontualidade" },
  { key: "qualidade", label: "Qualidade do serviço" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "profissionalismo", label: "Profissionalismo" },
  { key: "custo_beneficio", label: "Custo-benefício" },
];

const SUBCRITERIA_PROVIDER_TO_CLIENT = [
  { key: "pontualidade", label: "Pontualidade" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "respeito", label: "Respeito" },
  { key: "clareza", label: "Clareza nas instruções" },
  { key: "pagamento", label: "Pagamento em dia" },
];

interface Props {
  completedServiceId: string;
  reviewedProfileId: string;
  reviewType: "client_to_provider" | "provider_to_client";
  onSubmitted: () => void;
}

const BidirectionalReviewForm = ({ completedServiceId, reviewedProfileId, reviewType, onSubmitted }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [subcriteria, setSubcriteria] = useState<Record<string, number>>({});
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const criteria = reviewType === "client_to_provider" ? SUBCRITERIA_CLIENT_TO_PROVIDER : SUBCRITERIA_PROVIDER_TO_CLIENT;

  if (!user) return null;

  const allSubcriteriaFilled = criteria.every((c) => subcriteria[c.key] && subcriteria[c.key] > 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) toast({ title: "Arquivos maiores que 5MB ignorados", variant: "destructive" });
    setEvidenceFiles((prev) => [...prev, ...valid].slice(0, 3));
  };

  const handleSubmit = async () => {
    if (rating === 0 || !comment.trim() || !allSubcriteriaFilled) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setLoading(true);

    const { data: myProfileId } = await supabase.rpc("get_my_profile_id");
    if (!myProfileId || myProfileId === reviewedProfileId) {
      toast({ title: "Não é possível avaliar a si mesmo", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Insert review
    const { data: review, error } = await supabase
      .from("reviews")
      .insert({
        reviewer_id: myProfileId,
        reviewed_id: reviewedProfileId,
        completed_service_id: completedServiceId,
        review_type: reviewType,
        rating,
        comment: comment.trim(),
        is_published: false,
      })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Erro ao enviar avaliação", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Insert subcriteria
    const subRows = criteria.map((c) => ({
      review_id: review.id,
      criterion: c.key,
      score: subcriteria[c.key],
    }));
    await supabase.from("review_subcriteria").insert(subRows);

    // Upload evidence files
    for (const file of evidenceFiles) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${myProfileId}/${review.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("review-evidence").upload(path, file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("review-evidence").getPublicUrl(path);
        await supabase.from("review_evidence").insert({
          review_id: review.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
        });
      }
    }

    // Trigger reputation recomputation
    try {
      await supabase.functions.invoke("compute-reputation", {
        body: { profile_id: reviewedProfileId },
      });
    } catch { /* non-critical */ }

    // Try to publish blind reviews
    try {
      await supabase.rpc("publish_blind_reviews");
    } catch { /* non-critical */ }

    toast({ title: "Avaliação enviada com sucesso!" });
    onSubmitted();
    setLoading(false);
  };

  return (
    <div className="p-5 rounded-xl border border-border bg-card space-y-4">
      <h3 className="text-base font-display font-bold text-foreground">
        {reviewType === "client_to_provider" ? "Avaliar Profissional" : "Avaliar Cliente"}
      </h3>
      <p className="text-xs text-muted-foreground">
        Sua avaliação será publicada quando ambas as partes avaliarem, ou após 7 dias.
      </p>

      {/* Overall rating */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">Nota geral *</label>
        <StarRating rating={rating} onRate={setRating} size="md" />
      </div>

      {/* Subcriteria */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Critérios *</label>
        {criteria.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <StarRating
              rating={subcriteria[c.key] || 0}
              onRate={(v) => setSubcriteria((prev) => ({ ...prev, [c.key]: v }))}
            />
          </div>
        ))}
      </div>

      {/* Comment */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">Comentário *</label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Descreva sua experiência..."
          className="bg-background border-border min-h-[80px]"
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground mt-1">{comment.length}/1000</p>
      </div>

      {/* Evidence upload */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">Evidências (opcional)</label>
        <div className="flex items-center gap-2 flex-wrap">
          {evidenceFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg text-xs text-foreground">
              {f.name.slice(0, 20)}
              <button onClick={() => setEvidenceFiles((prev) => prev.filter((_, j) => j !== i))}>
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          {evidenceFiles.length < 3 && (
            <label className="cursor-pointer flex items-center gap-1 text-xs text-primary hover:underline">
              <Upload className="w-3.5 h-3.5" />
              Anexar
              <Input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
            </label>
          )}
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={loading || rating === 0 || !comment.trim() || !allSubcriteriaFilled}
        className="gap-2 w-full"
      >
        <Send className="w-3.5 h-3.5" />
        {loading ? "Enviando..." : "Enviar avaliação"}
      </Button>
    </div>
  );
};

export default BidirectionalReviewForm;
