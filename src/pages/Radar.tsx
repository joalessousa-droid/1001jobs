import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import { useProviderRadar, type RadarProvider } from "@/hooks/useProviderRadar";
import RadarMap from "@/components/radar/RadarMap";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Radar as RadarIcon, Star, Clock, CheckCircle2, Car, X, Route, FlaskConical } from "lucide-react";
import { useRouteSimulation } from "@/hooks/useRouteSimulation";
import { toast } from "sonner";

type RadarState =
  | "idle"
  | "searching"
  | "found"
  | "matching"
  | "requested"
  | "accepted"
  | "enroute"
  | "arrived";

interface Category { id: string; name: string }

const RadarPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  const navigate = useNavigate();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(true);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [state, setState] = useState<RadarState>("idle");
  const [selected, setSelected] = useState<RadarProvider | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pendingOffer, setPendingOffer] = useState<{ provider_id: string; expires_at: string } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [simulationRaw, setSimulationRaw] = useState(false);
  /* Modo simulação é exclusivo de administradores: valor efetivo derivado */
  const simulation = isAdmin && simulationRaw;
  const setSimulation = (v: boolean) => setSimulationRaw(isAdmin ? v : false);

  const [matched, setMatched] = useState<RadarProvider | null>(null);
  const nameCache = useRef<Record<string, string>>({});

  const active = state === "searching" || state === "found" || state === "matching" || state === "requested";

  const { providers, ranked, best, radius, expanding, loading, newIds, expandNow } = useProviderRadar({
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
    categoryId: categoryId || null,
    active,
    includeSynthetic: simulation,
    clientId: profileId,
  });

  // Deslocamento real (ruas, quadras e trânsito) do profissional escolhido
  const trip = useRouteSimulation({
    origin: matched ? { lat: matched.latitude, lng: matched.longitude } : null,
    destination: coords ? { lat: coords[0], lng: coords[1] } : null,
    active: !!matched && (state === "accepted" || state === "enroute"),
    speedFactor: simulation ? 60 : 1,
  });

  /* Modo simulação é exclusivo de administradores */
  useEffect(() => {
    if (!isAdmin) setSimulation(false);
  }, [isAdmin]);


  useEffect(() => {
    if (state === "accepted" && trip.position) setState("enroute");
    if (trip.arrived && state === "enroute") setState("arrived");
  }, [trip.position, trip.arrived, state]);

  // Geolocation
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

  // Profile + categories
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: prof }, { data: cats }] = await Promise.all([
        supabase.from("profiles").select("id, city, state, latitude, longitude").eq("user_id", user.id).maybeSingle(),
        supabase.from("service_categories").select("id, name").order("name"),
      ]);
      if (prof) {
        setProfileId(prof.id);
        setCoords((c) => c ?? (prof.latitude && prof.longitude ? [prof.latitude, prof.longitude] : null));
      }
      setCategories((cats ?? []) as Category[]);
    })();
  }, [user]);

  // State transitions driven by radar results
  useEffect(() => {
    if (state === "searching" && providers.length > 0) setState("found");
    if (state === "found" && providers.length === 0) setState("searching");
  }, [providers.length, state]);

  // Realtime offers for this request (matching → aceito)
  useEffect(() => {
    if (!requestId) return;
    const channel = supabase
      .channel(`radar-offers-${requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_offers", filter: `service_request_id=eq.${requestId}` },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          if (row.status === "pending") {
            setPendingOffer({ provider_id: row.provider_id, expires_at: row.expires_at });
            setState("requested");
          } else if (row.status === "accepted") {
            setPendingOffer(null);
            setMatched(providers.find((p) => p.provider_id === row.provider_id) ?? null);
            setState("accepted");
            toast.success("Profissional aceitou o serviço!");
          } else if (["declined", "expired"].includes(row.status)) {
            setPendingOffer(null);
            setState("matching");
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId, providers]);

  // Countdown for the pending offer
  useEffect(() => {
    if (!pendingOffer) { setCountdown(0); return; }
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(pendingOffer.expires_at).getTime() - Date.now()) / 1000));
      setCountdown(s);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [pendingOffer]);

  // Resolve provider names for offers
  useEffect(() => {
    const id = pendingOffer?.provider_id;
    if (!id || nameCache.current[id]) return;
    void supabase.from("profiles").select("display_name").eq("id", id).maybeSingle().then(({ data }) => {
      if (data?.display_name) nameCache.current[id] = data.display_name;
    });
  }, [pendingOffer]);

  const startRadar = useCallback(async () => {
    if (!user) { navigate("/auth"); return; }
    if (!profileId) { toast.error("Perfil não encontrado."); return; }
    if (!coords) { toast.error("Não foi possível obter sua localização."); return; }
    if (!categoryId) { toast.error("Selecione a categoria do serviço."); return; }

    setSubmitting(true);
    setState("searching");
    const { data: req, error } = await supabase
      .from("service_requests")
      .insert({
        profile_id: profileId,
        requester_name: user.email?.split("@")[0] ?? "Cliente",
        requester_type: "person",
        description: description.trim() || "Solicitação via Radar de Profissionais",
        category_id: categoryId,
        latitude: coords[0],
        longitude: coords[1],
        urgency: urgent ? "urgent" : "normal",
        search_radius: radius,
      } as any)
      .select("id")
      .single();
    setSubmitting(false);

    if (error || !req) {
      setState("idle");
      toast.error("Não foi possível abrir a solicitação.");
      return;
    }
    setRequestId(req.id);
  }, [user, profileId, coords, categoryId, description, urgent, radius, navigate]);

  const dispatchNow = useCallback(async () => {
    if (!requestId || !profileId || !coords) return;
    setState("matching");
    const { error } = await supabase.functions.invoke("dispatch-service-offers", {
      body: {
        service_request_id: requestId,
        client_id: profileId,
        category_id: categoryId || null,
        latitude: coords[0],
        longitude: coords[1],
        max_providers: 5,
        response_timeout_sec: 1800,
      },
    });
    if (error) {
      toast.error("Falha ao despachar a solicitação.");
      setState("found");
    }
  }, [requestId, profileId, coords, categoryId]);

  // Urgent flow: dispatch automatically as soon as providers are found
  useEffect(() => {
    if (urgent && requestId && state === "found" && providers.length > 0) {
      const t = window.setTimeout(() => void dispatchNow(), 1200);
      return () => window.clearTimeout(t);
    }
  }, [urgent, requestId, state, providers.length, dispatchNow]);

  const cancel = useCallback(async () => {
    if (requestId) {
      await supabase.from("service_requests").update({ is_active: false, status: "cancelled" } as any).eq("id", requestId);
    }
    setRequestId(null);
    setPendingOffer(null);
    setSelected(null);
    setMatched(null);
    setState("idle");
  }, [requestId]);

  const statusLabel = useMemo(() => {
    switch (state) {
      case "idle": return "Pronto para solicitar";
      case "searching": return "Procurando profissionais próximos…";
      case "found": return `${providers.length} ${providers.length === 1 ? "profissional disponível" : "profissionais disponíveis"}`;
      case "matching": return "Encontrando o melhor profissional para você…";
      case "requested": return `Solicitação enviada para ${nameCache.current[pendingOffer?.provider_id ?? ""] ?? "o profissional"}`;
      case "accepted": return "Profissional aceitou o serviço";
      case "enroute": return "Profissional a caminho";
      case "arrived": return "Seu profissional chegou";
    }
  }, [state, providers.length, pendingOffer]);

  const center: [number, number] = coords ?? [-23.5505, -46.6333];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-20 md:pt-24 pb-6">
        <header className="mb-4">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <RadarIcon className="w-6 h-6 text-primary" /> Radar de Profissionais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Veja em tempo real os profissionais disponíveis perto de você.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          {/* Painel de controle */}
          <Card className="p-4 space-y-4 h-fit">
            <div className="space-y-2">
              <Label>Categoria do serviço</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={active}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>O que você precisa?</Label>
              <Textarea
                rows={3}
                maxLength={500}
                value={description}
                disabled={active}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva rapidamente o serviço"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Serviço urgente</p>
                <p className="text-xs text-muted-foreground">Despacho automático para o melhor profissional</p>
              </div>
              <Switch checked={urgent} onCheckedChange={setUrgent} disabled={active} />
            </div>

            {isAdmin && (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1">
                  <FlaskConical className="w-3.5 h-3.5" /> Modo simulação
                </p>
                <p className="text-xs text-muted-foreground">
                  Vários profissionais no raio, resposta em até 30 min e deslocamento por ruas reais
                </p>
              </div>
              <Switch checked={simulation} onCheckedChange={setSimulation} disabled={active} />
            </div>
            )}


            {ranked.length > 0 && (
              <div className="space-y-2">
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
                          {i === 0 ? "⭐ " : ""}{p.display_name ?? "Profissional"}
                        </span>
                        {p.match_score != null && (
                          <Badge variant="secondary" className="text-[10px]">
                            match {Number(p.match_score).toFixed(0)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>📍 {p.distance_km.toFixed(1)} km</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{p.eta_min} min</span>
                        {p.is_synthetic && <span className="text-amber-500">demo</span>}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matched && (
              <Card className="p-3 border-primary/50 space-y-1">
                <p className="text-sm font-semibold flex items-center gap-1">
                  <Route className="w-4 h-4 text-primary" /> {matched.display_name ?? "Profissional"} a caminho
                </p>
                <p className="text-xs text-muted-foreground">
                  Rota {trip.routeKm != null ? `${trip.routeKm.toFixed(1)} km` : "—"} • tempo estimado {trip.routeMin ?? "—"} min
                </p>
                <p className="text-xs">
                  Faltam <strong>{trip.remainingKm != null ? `${trip.remainingKm.toFixed(1)} km` : "—"}</strong> •
                  chegada em <strong>{trip.etaMin ?? "—"} min</strong>
                </p>
                {trip.error && <p className="text-[11px] text-amber-500">{trip.error}</p>}
              </Card>
            )}

            {geoError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {geoError}
              </p>
            )}

            {state === "idle" ? (
              <Button
                className={`w-full h-12 text-base font-semibold ${urgent ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                onClick={startRadar}
                disabled={submitting || !coords}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {urgent ? "🔴 SOLICITAR AGORA" : "Procurar profissionais"}
              </Button>
            ) : (
              <div className="space-y-2">
                {state === "found" && !urgent && (
                  <Button className="w-full" onClick={dispatchNow}>Enviar solicitação ao melhor profissional</Button>
                )}
                <Button variant="outline" className="w-full" onClick={cancel}>
                  <X className="w-4 h-4 mr-2" /> Cancelar busca
                </Button>
              </div>
            )}

            {selected && (
              <Card className="p-3 border-primary/40">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-semibold">
                    {selected.avatar_url
                      ? <img src={selected.avatar_url} alt={selected.display_name ?? ""} className="w-full h-full object-cover" />
                      : (selected.display_name ?? "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{selected.display_name ?? "Profissional"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      {selected.rating ? <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-yellow-500" />{Number(selected.rating).toFixed(1)}</span> : null}
                      {selected.category_name && <span>🛠 {selected.category_name}</span>}
                      <span>📍 {selected.distance_km.toFixed(1)} km</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{selected.eta_min} min</span>
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="w-full mt-3" onClick={() => navigate(`/provider/${selected.provider_id}`)}>
                  Ver perfil
                </Button>
              </Card>
            )}
          </Card>

          {/* Mapa */}
          <div className="relative rounded-xl overflow-hidden border border-border" style={{ minHeight: 520 }}>
            <RadarMap
              className="w-full h-[520px] lg:h-[calc(100vh-220px)]"
              center={center}
              radiusKm={radius}
              providers={providers}
              newIds={newIds}
              urgent={urgent}
              searching={active}
              highlightId={matched?.provider_id ?? pendingOffer?.provider_id ?? best?.provider_id ?? null}
              onSelect={setSelected}
              routePath={trip.path}
              movingPosition={trip.position}
            />

            {/* Contador + estado */}
            <div className="absolute top-3 left-14 right-3 z-[500] flex flex-wrap items-center gap-2 pointer-events-none">
              <Badge
                variant="secondary"
                className={`pointer-events-auto backdrop-blur bg-card/90 border ${providers.length ? "border-primary/50" : "border-border"}`}
              >
                {providers.length > 0
                  ? `🔴 ${providers.length} ${providers.length === 1 ? "profissional disponível" : "profissionais disponíveis"}`
                  : "⚪ Nenhum profissional disponível no momento"}
              </Badge>
              {urgent && active && (
                <Badge className="pointer-events-auto bg-red-600 text-white hover:bg-red-600">
                  🔴 URGENTE — PROFISSIONAIS DISPONÍVEIS
                </Badge>
              )}
              <Badge variant="outline" className="pointer-events-auto bg-card/90 backdrop-blur">
                Raio {radius} km
              </Badge>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Faixa de estado inferior */}
            <div className="absolute bottom-3 left-3 right-3 z-[500] flex flex-col gap-2 items-start pointer-events-none">
              {expanding && (
                <Badge variant="secondary" className="bg-card/90 backdrop-blur">
                  Expandindo busca para encontrar mais profissionais…
                </Badge>
              )}
              {active && providers.length === 0 && !expanding && (
                <Button size="sm" variant="secondary" className="pointer-events-auto" onClick={expandNow}>
                  Continuar procurando
                </Button>
              )}
              <Card className="pointer-events-auto px-3 py-2 bg-card/95 backdrop-blur flex items-center gap-2 text-sm">
                {state === "accepted" ? <CheckCircle2 className="w-4 h-4 text-primary" />
                  : state === "enroute" ? <Car className="w-4 h-4 text-primary" />
                  : active ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  : <RadarIcon className="w-4 h-4 text-muted-foreground" />}
                <span>{statusLabel}</span>
                {state === "requested" && countdown > 0 && (
                  <span className="text-muted-foreground">
                    • {countdown >= 60 ? `${Math.floor(countdown / 60)}min ${countdown % 60}s` : `${countdown}s`} para aceitar
                  </span>
                )}
                {(state === "enroute" || state === "arrived") && trip.remainingKm != null && (
                  <span className="text-muted-foreground">
                    • {trip.remainingKm.toFixed(1)} km • chega em {trip.etaMin ?? 0} min
                  </span>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RadarPage;
