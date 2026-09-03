import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfessionalRadar, type RadarProfessional } from "@/hooks/useProfessionalRadar";
import { useRouteSimulation } from "@/hooks/useRouteSimulation";
import ProfessionalRadarMap from "./ProfessionalRadarMap";
import RadarHeader from "./RadarHeader";
import RadarBottomDrawer from "./RadarBottomDrawer";
import RadarDispatchStatus from "./RadarDispatchStatus";
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
    providerPosition,
    expandNow,
  } = useProfessionalRadar({
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
    categoryId: categoryId || null,
    active: running,
    urgent,
    includeSynthetic: simulation,
    clientId: profileId,
    serviceRequestId: requestId,
  });

  const target = accepted ?? (offer ? professionals.find((p) => p.provider_id === offer.provider_id) ?? null : null);

  const trip = useRouteSimulation({
    origin: target ? { lat: target.latitude, lng: target.longitude } : null,
    destination: coords ? { lat: coords[0], lng: coords[1] } : null,
    active: !!target && (stage === "accepted" || stage === "enroute"),
    speedFactor: simulation ? 60 : 1,
  });

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
          response_timeout_sec: 1800,
        },
      });
      if (error) {
        toast.error("Falha ao despachar a solicitação.");
        setStage("found");
      }
    },
    [profileId, coords, categoryId, setStage]
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
    setSubmitting(true);
    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        profile_id: profileId,
        requester_name: user.email?.split("@")[0] ?? "Cliente",
        requester_type: "person",
        description: description.trim() || "Solicitação via Radar Ao Vivo",
        category_id: categoryId || null,
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
    if (!user) {
      navigate("/auth");
      return;
    }
    setRunning(true);
    await createRequest();
  }, [user, navigate, createRequest]);

  // Despacho automático no modo urgente
  useEffect(() => {
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

  const cancel = useCallback(async () => {
    if (requestId) {
      await supabase
        .from("service_requests")
        .update({ is_active: false, status: "cancelled" } as any)
        .eq("id", requestId);
    }
    setRequestId(null);
    setSelected(null);
    setRunning(false);
  }, [requestId]);

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
                disabled={submitting || !coords}
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
            highlightId={highlightId}
            routePath={trip.path}
            movingPosition={providerPosition ?? trip.position}
            onSelect={setSelected}
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
