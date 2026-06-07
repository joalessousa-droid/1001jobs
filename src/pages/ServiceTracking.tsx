import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Clock, MapPin, Star, Loader2, Navigation } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useServiceTracking } from "@/hooks/useServiceTracking";
import LiveTrackingMap from "@/components/tracking/LiveTrackingMap";
import LocationSharingToggle from "@/components/tracking/LocationSharingToggle";

interface ServiceRow {
  id: string;
  title: string;
  status: string;
  client_id: string;
  provider_id: string;
}

const formatEta = (sec: number | null) => {
  if (!sec || sec <= 0) return "—";
  const min = Math.round(sec / 60);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}h${m ? ` ${m}min` : ""}`;
};

const formatKm = (m: number | null) => (m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

const ServiceTracking = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [service, setService] = useState<ServiceRow | null>(null);
  const [counterpart, setCounterpart] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [counterRating, setCounterRating] = useState<number | null>(null);
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load service + my profile
  useEffect(() => {
    (async () => {
      if (!user || !serviceId) return;
      const [{ data: prof }, { data: svc }] = await Promise.all([
        supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("services").select("id, title, status, client_id, provider_id").eq("id", serviceId).maybeSingle(),
      ]);
      setProfileId(prof?.id ?? null);
      setService(svc as any);
      setLoading(false);
      if (svc) {
        const otherId = (svc as any).client_id === prof?.id ? (svc as any).provider_id : (svc as any).client_id;
        const { data: other } = await (supabase as any).from("public_profiles")
          .select("display_name, avatar_url").eq("id", otherId).maybeSingle();
        setCounterpart(other ?? null);
        const { data: revs } = await supabase.from("reviews").select("rating").eq("reviewed_id", otherId);
        if (revs && revs.length) {
          const avg = revs.reduce((sum: number, r: any) => sum + (r.rating ?? 0), 0) / revs.length;
          setCounterRating(avg);
        }
      }
    })();
  }, [user, serviceId]);

  const isClient = service && profileId === service.client_id;
  const isProvider = service && profileId === service.provider_id;

  const tracking = useServiceTracking(serviceId ?? null, service?.provider_id ?? null);

  const saveDestination = async () => {
    const lat = Number(destLat), lng = Number(destLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setBusy(true);
    await tracking.setDestination(lat, lng);
    setBusy(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      setDestLat(String(p.coords.latitude));
      setDestLng(String(p.coords.longitude));
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!service || (!isClient && !isProvider)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Serviço não encontrado ou acesso negado.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold truncate">Rastreamento — {service.title}</h1>
          <p className="text-xs text-muted-foreground">Status: {service.status}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <LiveTrackingMap
          providerLocation={tracking.providerLocation}
          destination={tracking.destination}
          polyline={tracking.polyline}
          providerLabel={counterpart?.display_name ?? "Profissional"}
          className="h-[70vh] min-h-[400px] border border-border"
        />

        <div className="space-y-4">
          {isClient && counterpart && (
            <Card className="p-4 flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={counterpart.avatar_url ?? undefined} />
                <AvatarFallback>{counterpart.display_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{counterpart.display_name}</p>
                {counterRating != null && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {counterRating.toFixed(1)}
                  </p>
                )}
              </div>
            </Card>
          )}

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="w-4 h-4 text-primary" /> Chegada estimada</div>
            <p className="text-3xl font-bold font-display">{formatEta(tracking.etaSeconds)}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Navigation className="w-3 h-3" /> {formatKm(tracking.distanceMeters)} restantes
            </p>
            {tracking.lastEtaAt && (
              <p className="text-[10px] text-muted-foreground">
                Atualizado: {new Date(tracking.lastEtaAt).toLocaleTimeString("pt-BR")}
              </p>
            )}
          </Card>

          {isProvider && (
            <>
              <LocationSharingToggle providerId={service.provider_id} />
              {!tracking.destination && (
                <Card className="p-4 space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-semibold"><MapPin className="w-4 h-4" /> Definir destino</Label>
                  <p className="text-xs text-muted-foreground">Informe as coordenadas do local do serviço para calcular a rota.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Lat" value={destLat} onChange={(e) => setDestLat(e.target.value)} />
                    <Input placeholder="Lng" value={destLng} onChange={(e) => setDestLng(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={useMyLocation}>Usar minha posição</Button>
                    <Button size="sm" disabled={busy || !destLat || !destLng} onClick={saveDestination}>Salvar</Button>
                  </div>
                </Card>
              )}
            </>
          )}

          {isClient && !tracking.destination && (
            <Card className="p-4 text-sm text-muted-foreground">
              Aguardando o profissional definir o destino do serviço.
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default ServiceTracking;
