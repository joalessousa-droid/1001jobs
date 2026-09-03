import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useProfessionalRadar,
  type RadarProfessional,
  type RadarQuote,
} from "@/hooks/useProfessionalRadar";
import { useRouteSimulation } from "@/hooks/useRouteSimulation";
import { useProviderRates } from "@/hooks/useProviderRates";
import { useProviderReputation } from "@/hooks/useProviderReputation";
import { useRadarSandbox, type SandboxScenario } from "@/hooks/useRadarSandbox";
import { useRadarNotifications } from "@/hooks/useRadarNotifications";
import { logRadarEvent } from "@/hooks/useRadarHistory";
import ProfessionalRadarMap from "./ProfessionalRadarMap";
import RadarHeader from "./RadarHeader";
import RadarBottomDrawer from "./RadarBottomDrawer";
import RadarDispatchStatus from "./RadarDispatchStatus";
import RadarPriceOffers from "./RadarPriceOffers";
import RadarTestModePanel from "./RadarTestModePanel";
import RadarHistoryPanel from "./RadarHistoryPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, X, FlaskConical } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

const ProfessionalRadar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(true);
  const [simulation, setSimulation] = useState(false);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RadarProfessional | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [simAccepted, setSimAccepted] = useState<RadarProfessional | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [scenario, setScenario] = useState<SandboxScenario>("near_available");
  const [testRequestId, setTestRequestId] = useState<string | null>(null);
  const simSeeded = useRef<string | null>(null);

  const {
    professionals,
    ranked,
    best,
    accepted,
    radius,
    expanding,
    loading,
    newIds,
    stage,
    setStage,
    offer,
    quotes,
    setQuotes,
    acceptQuote,
    providerPosition,
    expandNow,
  } = useProfessionalRadar({
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
    categoryId: categoryId || null,
    active: running && !testMode,
    urgent,
    includeSynthetic: simulation,
    clientId: profileId,
    serviceRequestId: testMode ? null : requestId,
  });

  /* Modo de teste: perfis bot locais, sem tocar em dados reais */
  const sandbox = useRadarSandbox({
    active: testMode,
    scenario,
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
    categoryName: categories.find((c) => c.id === categoryId)?.name ?? null,
    urgent,
    requesting: testMode && running,
  });

  const liveProfessionals = testMode ? sandbox.professionals : professionals;
  const liveQuotes = testMode ? sandbox.quotes : quotes;

  const rates = useProviderRates(
    professionals.map((p) => p.provider_id),
    categoryId || null
  );

  const reputation = useProviderReputation(liveProfessionals.map((p) => p.provider_id));

  const target =
    simAccepted ??
    accepted ??
    (offer ? liveProfessionals.find((p) => p.provider_id === offer.provider_id) ?? null : null);

  const trip = useRouteSimulation({
    origin: target ? { lat: target.latitude, lng: target.longitude } : null,
    destination: coords ? { lat: coords[0], lng: coords[1] } : null,
    active: !!target && (stage === "accepted" || stage === "enroute"),
    speedFactor: simulation || testMode ? 60 : 1,
  });

  const nameOf = useCallback(
    (id: string) =>
      liveProfessionals.find((p) => p.provider_id === id)?.display_name ?? "Profissional",
    [liveProfessionals]
  );

  const activeRequestId = testMode ? testRequestId : requestId;

  const logEvent = useCallback(
    (label: string, extra?: { provider_name?: string; price?: number | null }) => {
      if (!activeRequestId) return;
      logRadarEvent({
        request_id: activeRequestId,
        stage: "quote",
        label,
        provider_name: extra?.provider_name ?? null,
        price: extra?.price ?? null,
        sandbox: testMode,
      });
    },
    [activeRequestId, testMode]
  );

  useRadarNotifications({
    active: running,
    stage,
    quotes: liveQuotes,
    serviceRequestId: testMode ? null : requestId,
    nameOf,
    onEvent: logEvent,
  });

  /* Máquina de estados local do modo de teste */
  useEffect(() => {
    if (!testMode || !running) return;
    if (stage === "idle" || stage === "locating") {
      setStage(coords ? "scanning" : "locating");
      return;
    }
    if (stage === "scanning" && sandbox.professionals.length > 0) {
      const t = window.setTimeout(() => setStage("offer_sent"), 900);
      return () => window.clearTimeout(t);
    }
  }, [testMode, running, stage, coords, sandbox.professionals.length, setStage]);

  useEffect(() => {
    if (stage === "accepted" && trip.position) setStage("enroute");
    if (trip.arrived && stage === "enroute") setStage("arrived");
  }, [trip.position, trip.arrived, stage, setStage]);

  // Geolocalização
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocalização não suportada neste dispositivo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords([pos.coords.latitude, pos.coords.longitude]),
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  // Perfil + categorias
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: prof }, { data: cats }] = await Promise.all([
        supabase.from("profiles").select("id, latitude, longitude").eq("user_id", user.id).maybeSingle(),
        supabase.from("service_categories").select("id, name").order("name"),
      ]);
      if (prof) {
        setProfileId(prof.id);
        setCoords((c) => c ?? (prof.latitude && prof.longitude ? [prof.latitude, prof.longitude] : null));
      }
      setCategories((cats ?? []) as Category[]);
    })();
  }, [user]);

  const dispatchNow = useCallback(
    async (reqId: string, preferred?: string | null) => {
      if (!profileId || !coords) return;
      setStage("dispatching");
      const { error } = await supabase.functions.invoke("dispatch-service-offers", {
        body: {
          service_request_id: reqId,
          client_id: profileId,
          category_id: categoryId || null,
          latitude: coords[0],
          longitude: coords[1],
          max_providers: preferred ? 1 : 5,
          preferred_provider_id: preferred ?? null,
          broadcast: !preferred,
          radius_km: radius,
          response_timeout_sec: 1800,
        },
      });
      if (error) {
        toast.error("Falha ao despachar a solicitação.");
        setStage("found");
      }
    },
    [profileId, coords, categoryId, radius, setStage]
  );

  const createRequest = useCallback(async () => {
    if (!user) {
      navigate("/auth");
      return null;
    }
    if (!profileId) {
      toast.error("Perfil não encontrado.");
      return null;
    }
    if (!coords) {
      toast.error("Não foi possível obter sua localização.");
      return null;
    }
    if (!categoryId) {
      toast.error("Escolha a categoria do serviço para abrir a solicitação.");
      return null;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        profile_id: profileId,
        requester_name: user.email?.split("@")[0] ?? "Cliente",
        requester_type: "person",
        description: description.trim() || "Solicitação via Radar Ao Vivo",
        category_id: categoryId,
        latitude: coords[0],
        longitude: coords[1],
        urgency: urgent ? "urgent" : "normal",
        search_radius: radius,
      } as any)
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Não foi possível abrir a solicitação.");
      return null;
    }
    setRequestId(data.id);
    return data.id as string;
  }, [user, profileId, coords, description, categoryId, urgent, radius, navigate]);

  const start = useCallback(async () => {
    if (testMode) {
      const id = `test-${Date.now()}`;
      setTestRequestId(id);
      sandbox.reset();
      setSimAccepted(null);
      setRunning(true);
      setStage(coords ? "scanning" : "locating");
      logRadarEvent({
        request_id: id,
        stage: "locating",
        label: `Sessão de teste iniciada (${scenario})`,
        sandbox: true,
      });
      return;
    }
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!categoryId) {
      toast.error("Escolha a categoria do serviço.");
      return;
    }
    setRunning(true);
    const id = await createRequest();
    if (!id) setRunning(false);
  }, [testMode, sandbox, coords, scenario, setStage, user, navigate, createRequest, categoryId]);

  // Despacho automático no modo urgente
  useEffect(() => {
    if (testMode) return;
    if (!urgent || !requestId || stage !== "found" || professionals.length === 0) return;
    const t = window.setTimeout(() => void dispatchNow(requestId), 1200);
    return () => window.clearTimeout(t);
  }, [urgent, requestId, stage, professionals.length, dispatchNow]);

  const requestProfessional = useCallback(
    async (p: RadarProfessional) => {
      const id = requestId ?? (await createRequest());
      if (!id) return;
      setSelected(null);
      await dispatchNow(id, p.provider_id);
    },
    [requestId, createRequest, dispatchNow]
  );

  /* Modo simulação: os bots sintéticos enviam orçamentos como profissionais reais */
  const professionalsRef = useRef(professionals);
  const ratesRef = useRef(rates);
  professionalsRef.current = professionals;
  ratesRef.current = rates;
  const simTimers = useRef<number[]>([]);

  useEffect(() => {
    if (!simulation || !running || !requestId) return;
    if (simSeeded.current === requestId) return;
    const bots = professionalsRef.current.filter((p) => p.is_synthetic).slice(0, 5);
    if (bots.length === 0) return;
    simSeeded.current = requestId;
    setStage("offer_sent");
    simTimers.current = bots.map((b, i) =>
      window.setTimeout(() => {
        const base = ratesRef.current[b.provider_id] ?? 28;
        const price = Number((base + b.distance_km * 6.5 + (b.eta_min ?? 0) * 0.8).toFixed(2));
        setQuotes((prev) =>
          [
            ...prev.filter((q) => q.provider_id !== b.provider_id),
            {
              offer_id: `sim-${b.provider_id}`,
              provider_id: b.provider_id,
              price,
              note: null,
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              distance_km: b.distance_km,
              simulated: true,
            },
          ].sort((a, b2) => a.price - b2.price)
        );
      }, 1500 + i * 1400)
    );
  }, [simulation, running, requestId, professionals.length, setQuotes, setStage]);

  useEffect(() => {
    if (!running) {
      simSeeded.current = null;
      setSimAccepted(null);
      simTimers.current.forEach((t) => window.clearTimeout(t));
      simTimers.current = [];
    }
  }, [running]);

  useEffect(() => () => simTimers.current.forEach((t) => window.clearTimeout(t)), []);

  const handleAcceptQuote = useCallback(
    async (q: RadarQuote) => {
      setAccepting(q.offer_id);
      try {
        if (q.simulated) {
          const bot = liveProfessionals.find((p) => p.provider_id === q.provider_id) ?? null;
          setSimAccepted(bot);
          if (testMode) sandbox.setQuotes([]);
          else setQuotes([]);
          setStage("accepted");
          toast.success("Serviço aceito — profissional a caminho.");
        } else {
          await acceptQuote(q.offer_id);
          toast.success("Serviço aceito — profissional a caminho.");
        }
        if (activeRequestId) {
          logRadarEvent({
            request_id: activeRequestId,
            stage: "accepted",
            label: "Oferta aceita",
            provider_name: nameOf(q.provider_id),
            price: q.price,
            sandbox: testMode,
          });
        }
      } catch (e) {
        toast.error((e as Error).message ?? "Não foi possível aceitar a oferta.");
      } finally {
        setAccepting(null);
      }
    },
    [liveProfessionals, testMode, sandbox, acceptQuote, setQuotes, setStage, activeRequestId, nameOf]
  );

  /* Registra a chegada no histórico */
  useEffect(() => {
    if (stage !== "arrived" || !activeRequestId) return;
    logRadarEvent({
      request_id: activeRequestId,
      stage: "arrived",
      label: "Profissional chegou ao local",
      sandbox: testMode,
    });
  }, [stage, activeRequestId, testMode]);

  const cancel = useCallback(async () => {
    if (requestId && !testMode) {
      await supabase
        .from("service_requests")
        .update({ is_active: false, status: "cancelled" } as any)
        .eq("id", requestId);
    }
    if (activeRequestId) {
      logRadarEvent({
        request_id: activeRequestId,
        stage: "cancelled",
        label: "Solicitação cancelada",
        sandbox: testMode,
      });
    }
    setRequestId(null);
    setTestRequestId(null);
    setSelected(null);
    setSimAccepted(null);
    setQuotes([]);
    sandbox.reset();
    setRunning(false);
    setStage("idle");
  }, [requestId, testMode, activeRequestId, setQuotes, sandbox, setStage]);

  const center: [number, number] = coords ?? [-23.5505, -46.6333];
  const highlightId = accepted?.provider_id ?? offer?.provider_id ?? best?.provider_id ?? null;

  return (
    <div className="space-y-4" data-testid="professional-radar">
      <RadarHeader
        count={professionals.length}
        urgent={urgent}
        onUrgentChange={setUrgent}
        radiusKm={radius}
        expanding={expanding}
        loading={loading}
        categories={categories}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        disabled={running}
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>O que você precisa?</Label>
              <Textarea
                rows={3}
                maxLength={500}
                value={description}
                disabled={running}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva rapidamente o serviço"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1">
                  <FlaskConical className="w-3.5 h-3.5" /> Modo simulação
                </p>
                <p className="text-xs text-muted-foreground">
                  Vários profissionais no raio e deslocamento por ruas reais
                </p>
              </div>
              <Switch checked={simulation} onCheckedChange={setSimulation} disabled={running} />
            </div>

            {geoError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {geoError}
              </p>
            )}

            {!running ? (
              <Button
                className={`w-full h-12 text-base font-semibold ${urgent ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                onClick={start}
                disabled={submitting || !coords || !categoryId}
                data-testid="radar-start"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {urgent ? "🔴 SOLICITAR AGORA" : "Ativar radar"}
              </Button>
            ) : (
              <div className="space-y-2">
                {stage === "found" && !urgent && requestId && (
                  <Button className="w-full" onClick={() => void dispatchNow(requestId)}>
                    Enviar ao melhor profissional
                  </Button>
                )}
                {professionals.length === 0 && !expanding && (
                  <Button variant="secondary" className="w-full" onClick={expandNow}>
                    Continuar procurando
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={cancel}>
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              </div>
            )}

            {!running && !categoryId && (
              <p className="text-xs text-muted-foreground text-center">
                Selecione uma categoria acima para solicitar.
              </p>
            )}
          </Card>

          {running && (
            <RadarDispatchStatus
              stage={stage}
              expiresAt={offer?.expires_at ?? null}
              remainingKm={trip.remainingKm}
              etaMin={trip.etaMin}
            />
          )}

          {ranked.length > 0 && (
            <Card className="p-3 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Ranking de match ({ranked.length})
              </Label>
              <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
                {ranked.slice(0, 8).map((p, i) => (
                  <button
                    key={p.provider_id}
                    onClick={() => setSelected(p)}
                    className={`w-full text-left rounded-lg border p-2 transition-colors hover:bg-muted/60 ${
                      i === 0 ? "border-primary/50" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {i === 0 ? "⭐ " : ""}
                        {p.display_name ?? "Profissional"}
                      </span>
                      {p.match_score != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          match {Number(p.match_score).toFixed(0)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      📍 {p.distance_km.toFixed(1)} km · ⏱ {p.eta_min} min
                      {rates[p.provider_id]
                        ? ` · a partir de ${rates[p.provider_id].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                        : ""}
                      {p.is_synthetic ? " · demo" : ""}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="relative rounded-xl overflow-hidden border border-border" style={{ minHeight: 520 }}>
          <ProfessionalRadarMap
            className="w-full h-[520px] lg:h-[calc(100vh-260px)]"
            center={center}
            radiusKm={radius}
            professionals={professionals}
            newIds={newIds}
            urgent={urgent}
            scanning={running}
            highlightId={simAccepted?.provider_id ?? highlightId}
            routePath={trip.path}
            movingPosition={providerPosition ?? trip.position}
            onSelect={setSelected}
          />
          <RadarPriceOffers
            quotes={quotes}
            professionals={professionals}
            rates={rates}
            waiting={running && (stage === "dispatching" || stage === "offer_sent")}
            accepting={accepting}
            onAccept={handleAcceptQuote}
          />
          <RadarBottomDrawer
            professional={selected}
            onClose={() => setSelected(null)}
            onRequest={(p) => void requestProfessional(p)}
            onViewProfile={(p) => navigate(`/provider/${p.provider_id}`)}
            requesting={submitting}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfessionalRadar;
