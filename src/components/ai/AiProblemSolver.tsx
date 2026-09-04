import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera,
  Mic,
  MapPin,
  Sparkles,
  Loader2,
  AlertTriangle,
  ArrowRight,
  X,
  RefreshCw,
} from "lucide-react";
import { use1001AI } from "@/hooks/use1001AI";
import { supabase } from "@/integrations/supabase/client";
import MarketPriceCard from "@/components/ai/MarketPriceCard";
import { recordPrediction } from "@/lib/ai1001Learning";
import { COMPLEXITY_LABEL, URGENCY_LABEL, formatPriceRange } from "@/lib/ai1001";

const EXAMPLES = [
  "Minha torneira está vazando.",
  "O ar-condicionado não está gelando.",
  "Preciso instalar uma TV.",
  "Minha tomada parou de funcionar.",
  "Preciso montar um guarda-roupa.",
  "Quero alguém para limpar minha casa.",
  "Meu computador não liga.",
];

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const AiProblemSolver = () => {
  const navigate = useNavigate();
  const { stage, diagnosis, error, run, answerQuestions, reset, matchCategoryId } = use1001AI();

  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const id = setInterval(() => setExampleIndex((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(id);
  }, []);

  const busy = stage === "analyzing";

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 6 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const useLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Localização indisponível neste dispositivo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Localização adicionada ao diagnóstico.");
      },
      () => toast.error("Não foi possível obter sua localização."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const toggleVoice = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Reconhecimento de voz não suportado neste navegador.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ");
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const analyze = () => {
    if (!text.trim() && !image) {
      toast.error("Descreva o problema ou envie uma foto.");
      return;
    }
    run({ text: text.trim(), image_base64: image, location: coords });
  };

  const goToRadar = (urgent: boolean) => {
    const categoryId = matchCategoryId(diagnosis?.category);
    const params = new URLSearchParams();
    if (categoryId) params.set("cat", categoryId);
    if (diagnosis?.problem_detected) params.set("desc", diagnosis.problem_detected);
    params.set("urgent", urgent ? "1" : "0");
    navigate(`/radar?${params.toString()}`);
  };

  // 39/40/46 — contexto regional + registro explicável da previsão
  const [geo, setGeo] = useState<{ city: string | null; state: string | null }>({ city: null, state: null });
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("city, state")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (alive && profile) setGeo({ city: profile.city ?? null, state: profile.state ?? null });
    });
    return () => {
      alive = false;
    };
  }, []);

  const predictionRef = useRef<string | null>(null);
  useEffect(() => {
    if (stage !== "diagnosed" || !diagnosis) return;
    void recordPrediction({
      diagnosis: diagnosis.problem_detected,
      category: diagnosis.category,
      recommended_profession: diagnosis.recommended_profession,
      confidence: diagnosis.confidence,
      estimated_price_min: diagnosis.estimated_price_min,
      estimated_price_max: diagnosis.estimated_price_max,
      urgency: diagnosis.urgency,
      complexity: diagnosis.complexity,
      city: geo.city,
      state: geo.state,
      evidence: {
        reasons: diagnosis.reasons,
        has_image: Boolean(image),
        has_location: Boolean(coords),
        summary: diagnosis.summary,
      },
    }).then((id) => {
      predictionRef.current = id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, diagnosis]);

  const priceLabel = useMemo(
    () =>
      diagnosis ? formatPriceRange(diagnosis.estimated_price_min, diagnosis.estimated_price_max) : "",
    [diagnosis],
  );

  return (
    <section className="container px-6 py-16" id="ai-1001">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4 gap-1 border-primary/30 text-primary">
            <Sparkles className="w-3.5 h-3.5" /> 1001 AI
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold font-display tracking-tight mb-3">
            O que você precisa resolver?
          </h2>
          <p className="text-muted-foreground">
            Conte o que aconteceu. A 1001Jobs identifica o problema e encontra quem pode resolver.
          </p>
        </div>

        <Card className="p-4 md:p-6 border-border/60">
          <Textarea
            data-testid="ai-problem-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLES[exampleIndex]}
            rows={3}
            className="resize-none text-base"
            disabled={busy}
          />

          {image && (
            <div className="mt-3 relative w-28 h-28">
              <img src={image} alt="Foto do problema enviada" className="w-full h-full object-cover rounded-lg" />
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => setImage(null)}
                className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar uma foto</span>
            </Button>
            <Button
              type="button"
              variant={listening ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={toggleVoice}
              disabled={busy}
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">{listening ? "Ouvindo..." : "Descrever por voz"}</span>
            </Button>
            <Button
              type="button"
              variant={coords ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={useLocation}
              disabled={busy}
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">{coords ? "Localização ativa" : "Usar minha localização"}</span>
            </Button>

            <Button
              type="button"
              className="ml-auto gap-2"
              onClick={analyze}
              disabled={busy}
              data-testid="ai-analyze"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? "Analisando..." : "Analisar com 1001 AI"}
            </Button>
          </div>
        </Card>

        {stage === "error" && (
          <Card className="mt-4 p-4 border-destructive/40">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={analyze}>
                <RefreshCw className="w-4 h-4" /> Tentar novamente
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate("/buscar")}>
                Buscar manualmente
              </Button>
            </div>
          </Card>
        )}

        {diagnosis && stage === "clarification" && (
          <Card className="mt-4 p-4 md:p-6" data-testid="ai-clarification">
            <p className="text-sm text-muted-foreground mb-4">
              Ainda não tenho certeza. Me ajude com {diagnosis.required_questions.length === 1 ? "uma pergunta" : "algumas perguntas"}:
            </p>
            <div className="space-y-4">
              {diagnosis.required_questions.map((q) => (
                <div key={q.question}>
                  <p className="font-medium mb-2">{q.question}</p>
                  <div className="flex flex-wrap gap-2">
                    {(q.options.length ? q.options : ["Sim", "Não", "Não sei"]).map((opt) => (
                      <Button
                        key={opt}
                        size="sm"
                        variant="outline"
                        onClick={() => answerQuestions([{ question: q.question, answer: opt }])}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {diagnosis && stage === "diagnosed" && (
          <Card className="mt-4 p-4 md:p-6 space-y-5" data-testid="ai-diagnosis">
            {diagnosis.safety_warnings.length > 0 && (
              <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <div className="text-sm space-y-1">
                  {diagnosis.safety_warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Entendi o problema</p>
              <h3 className="text-xl font-semibold">{diagnosis.problem_detected}</h3>
              <p className="text-sm text-muted-foreground mt-1">{diagnosis.summary}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Profissional</p>
                <p className="font-medium">{diagnosis.recommended_profession}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estimativa 1001</p>
                <p className="font-medium">{priceLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Complexidade</p>
                <p className="font-medium">{COMPLEXITY_LABEL[diagnosis.complexity]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Urgência</p>
                <p className="font-medium">{URGENCY_LABEL[diagnosis.urgency]}</p>
              </div>
            </div>

            {diagnosis.reasons.length > 0 && (
              <ul className="text-sm text-muted-foreground space-y-1">
                {diagnosis.reasons.map((r) => (
                  <li key={r}>✓ {r}</li>
                ))}
              </ul>
            )}

            {diagnosis.category && (
              <MarketPriceCard
                category={diagnosis.category}
                city={geo.city}
                state={geo.state}
                urgency={diagnosis.urgency === "urgente" ? "urgente" : "normal"}
                complexity={diagnosis.complexity}
                audience="client"
              />
            )}

            <p className="text-xs text-muted-foreground">
              Estimativa inicial de referência. O valor final pode variar após avaliação do profissional.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button className="gap-2" onClick={() => goToRadar(false)} data-testid="ai-find-professional">
                Encontrar profissional <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="destructive"
                onClick={() => goToRadar(true)}
                data-testid="ai-urgent"
              >
                É urgente
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                Quero enviar uma foto
              </Button>
              <Button variant="ghost" onClick={reset}>
                Recomeçar
              </Button>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
};

export default AiProblemSolver;
