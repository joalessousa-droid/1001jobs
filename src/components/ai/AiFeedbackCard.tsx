import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, HelpCircle, X } from "lucide-react";
import { recordOutcome } from "@/lib/ai1001Learning";

interface Props {
  serviceId?: string | null;
  predictionId?: string | null;
  category?: string;
  providerId?: string | null;
  clientId?: string | null;
  city?: string | null;
  state?: string | null;
  role: "provider" | "client";
  onDone?: () => void;
}

/**
 * 29/30 — Feedback supervisionado do profissional e do cliente após o atendimento.
 * Alimenta o 1001 AI Learning Engine (loop de correção).
 */
const AiFeedbackCard = ({
  serviceId,
  predictionId,
  category,
  providerId,
  clientId,
  city,
  state,
  role,
  onDone,
}: Props) => {
  const [answer, setAnswer] = useState<"sim" | "parcial" | "nao" | null>(null);
  const [correction, setCorrection] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [helped, setHelped] = useState<boolean | null>(null);
  const [priceOk, setPriceOk] = useState<boolean | null>(null);
  const [solved, setSolved] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await recordOutcome({
        prediction_id: predictionId ?? null,
        service_id: serviceId ?? null,
        provider_id: providerId ?? null,
        client_id: clientId ?? null,
        category,
        city,
        state,
        actual_price: price ? Number(price) : undefined,
        actual_duration_min: duration ? Number(duration) : undefined,
        professional_feedback: role === "provider" ? (answer ?? undefined) : undefined,
        professional_correction: role === "provider" ? correction || undefined : undefined,
        actual_diagnosis: role === "provider" ? correction || undefined : undefined,
        client_feedback:
          role === "client"
            ? { estimate_helped: helped, price_expected: priceOk, problem_solved: solved }
            : {},
      });
      setSent(true);
      toast.success("Obrigado! A 1001 AI aprendeu com este atendimento.");
      onDone?.();
    } catch {
      toast.error("Não foi possível registrar sua resposta agora.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Card className="p-4" data-testid="ai-feedback-card">
        <p className="text-sm text-muted-foreground">Resposta registrada. Obrigado!</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3" data-testid="ai-feedback-card">
      {role === "provider" ? (
        <>
          <p className="text-sm font-medium">O diagnóstico da 1001 AI estava correto?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={answer === "sim" ? "default" : "outline"}
              onClick={() => setAnswer("sim")}
              data-testid="ai-feedback-yes"
            >
              <Check className="h-4 w-4 mr-1" /> Sim
            </Button>
            <Button
              size="sm"
              variant={answer === "parcial" ? "default" : "outline"}
              onClick={() => setAnswer("parcial")}
              data-testid="ai-feedback-partial"
            >
              <HelpCircle className="h-4 w-4 mr-1" /> Parcialmente
            </Button>
            <Button
              size="sm"
              variant={answer === "nao" ? "default" : "outline"}
              onClick={() => setAnswer("nao")}
              data-testid="ai-feedback-no"
            >
              <X className="h-4 w-4 mr-1" /> Não
            </Button>
          </div>
          {answer && answer !== "sim" && (
            <Textarea
              placeholder="Qual era o problema de fato?"
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              data-testid="ai-feedback-correction"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Valor cobrado (R$)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              data-testid="ai-feedback-price"
            />
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Duração (min)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              data-testid="ai-feedback-duration"
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Como foi o atendimento?</p>
          {[
            { label: "A estimativa ajudou?", value: helped, set: setHelped, id: "helped" },
            { label: "O profissional resolveu o problema?", value: solved, set: setSolved, id: "solved" },
            { label: "O preço ficou dentro do esperado?", value: priceOk, set: setPriceOk, id: "price" },
          ].map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{q.label}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={q.value === true ? "default" : "outline"}
                  onClick={() => q.set(true)}
                  data-testid={`ai-feedback-${q.id}-yes`}
                >
                  Sim
                </Button>
                <Button
                  size="sm"
                  variant={q.value === false ? "default" : "outline"}
                  onClick={() => q.set(false)}
                  data-testid={`ai-feedback-${q.id}-no`}
                >
                  Não
                </Button>
              </div>
            </div>
          ))}
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Valor pago (R$)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid="ai-feedback-price"
          />
        </>
      )}

      <Button
        className="w-full"
        onClick={submit}
        disabled={sending || (role === "provider" && !answer)}
        data-testid="ai-feedback-submit"
      >
        Enviar resposta
      </Button>
    </Card>
  );
};

export default AiFeedbackCard;
