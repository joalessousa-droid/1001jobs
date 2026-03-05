import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Upload, X, Send } from "lucide-react";

interface Props {
  reviewId: string;
  onSubmitted: () => void;
  onCancel: () => void;
}

const DisputeForm = ({ reviewId, onSubmitted, onCancel }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).filter((f) => f.size <= 5 * 1024 * 1024);
    setFiles((prev) => [...prev, ...newFiles].slice(0, 5));
  };

  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 20) {
      toast({ title: "Justificativa deve ter pelo menos 20 caracteres", variant: "destructive" });
      return;
    }
    setLoading(true);

    const { data: myProfileId } = await supabase.rpc("get_my_profile_id");
    if (!myProfileId) {
      toast({ title: "Erro ao obter perfil", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Upload evidence files
    const evidenceUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `disputes/${myProfileId}/${reviewId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("review-evidence").upload(path, file);
      if (!upErr) {
        const { data } = supabase.storage.from("review-evidence").getPublicUrl(path);
        evidenceUrls.push(data.publicUrl);
      }
    }

    const { error } = await supabase.from("review_disputes").insert({
      review_id: reviewId,
      disputed_by: myProfileId,
      reason: reason.trim(),
      evidence_urls: evidenceUrls,
    });

    if (error) {
      toast({ title: "Erro ao abrir disputa", description: error.message, variant: "destructive" });
    } else {
      // Mark review as contested
      await supabase.from("reviews").update({ is_contested: true }).eq("id", reviewId);
      toast({ title: "Disputa aberta com sucesso" });
      onSubmitted();
    }
    setLoading(false);
  };

  return (
    <div className="p-5 rounded-xl border border-destructive/30 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-display font-bold text-foreground">Contestar Avaliação</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Descreva o motivo da contestação. A avaliação será suspensa durante a análise.
      </p>

      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explique detalhadamente por que esta avaliação deve ser revisada..."
        className="bg-background border-border min-h-[100px]"
        maxLength={2000}
      />
      <p className="text-xs text-muted-foreground">{reason.length}/2000</p>

      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">Provas (opcional)</label>
        <div className="flex items-center gap-2 flex-wrap">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg text-xs text-foreground">
              {f.name.slice(0, 20)}
              <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          {files.length < 5 && (
            <label className="cursor-pointer flex items-center gap-1 text-xs text-primary hover:underline">
              <Upload className="w-3.5 h-3.5" />
              Anexar prova
              <Input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading || reason.trim().length < 20} className="flex-1 gap-2">
          <Send className="w-3.5 h-3.5" />
          {loading ? "Enviando..." : "Abrir disputa"}
        </Button>
      </div>
    </div>
  );
};

export default DisputeForm;
