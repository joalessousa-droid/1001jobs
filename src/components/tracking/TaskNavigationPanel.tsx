// Modo Navegação da Tarefa — painel do prestador (contextual à tarefa aceita).
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MapPin, Navigation, Loader2, X, Route } from "lucide-react";
import { availableNavApps, openNavApp, type NavAppOption } from "@/lib/navigationApps";
import { useTaskNavigation, type NavState } from "@/hooks/useTaskNavigation";

interface Props {
  serviceId: string;
  isProvider: boolean;
  clientLabel?: string | null;
  destination: { lat: number; lng: number; address?: string | null } | null;
  position: { latitude: number; longitude: number; accuracy?: number | null; speed?: number | null } | null;
  etaSeconds?: number | null;
  distanceMeters?: number | null;
}

const STATE_LABEL: Record<NavState, string> = {
  ACCEPTED: "Tarefa aceita",
  NAVIGATION_STARTED: "Navegação iniciada",
  EN_ROUTE: "A caminho",
  ARRIVAL_DETECTED: "Chegada detectada",
  ARRIVED: "No local",
  SERVICE_STARTED: "Serviço iniciado",
  SERVICE_COMPLETED: "Serviço concluído",
};

const fmtEta = (sec?: number | null) => (!sec || sec <= 0 ? "—" : sec < 60 ? "< 1 min" : `${Math.round(sec / 60)} min`);
const fmtDist = (m?: number | null) => (m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

const TaskNavigationPanel = ({
  serviceId, isProvider, clientLabel, destination, position, etaSeconds, distanceMeters,
}: Props) => {
  const nav = useTaskNavigation({ serviceId, isProvider, destination, position });
  const [chooser, setChooser] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const apps = useMemo<NavAppOption[]>(
    () => (destination ? availableNavApps({ lat: destination.lat, lng: destination.lng, address: destination.address }) : []),
    [destination],
  );

  const launch = async (app: NavAppOption) => {
    setChooser(false);
    await nav.startNavigation(app);
    openNavApp(app);
    toast.success(`Navegação aberta no ${app.label}. O acompanhamento da 1001Jobs continua ativo.`);
  };

  const onStart = () => {
    if (!apps.length) {
      toast.error("Instale o Waze ou o Google Maps para iniciar a navegação.");
      return;
    }
    if (apps.length === 1) { void launch(apps[0]); return; }
    setChooser(true);
  };

  if (!isProvider) return null;

  if (minimized) {
    return (
      <Card className="p-3 flex items-center justify-between gap-2" data-testid="task-navigation-minimized">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Route className="w-3.5 h-3.5 text-primary" /> {STATE_LABEL[nav.navState]} · acompanhamento ativo
        </span>
        <Button size="sm" variant="outline" onClick={() => setMinimized(false)} data-testid="task-navigation-reopen">
          Abrir
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3" data-testid="task-navigation-panel">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-primary" /> Modo navegação
          </p>
          <p className="text-xs text-muted-foreground truncate">{clientLabel ?? "Cliente"}</p>
        </div>
        <Badge variant="secondary" data-testid="task-navigation-state">{STATE_LABEL[nav.navState]}</Badge>
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span data-testid="task-navigation-address">
          {destination?.address ??
            (destination ? `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}` : "Destino ainda não definido")}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Distância</p>
          <p className="font-semibold" data-testid="task-navigation-distance">
            {fmtDist(nav.distanceM ?? distanceMeters)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Chegada estimada</p>
          <p className="font-semibold">{fmtEta(etaSeconds)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onStart} disabled={!destination} data-testid="task-navigation-start" className="gap-1.5">
          <Navigation className="w-4 h-4" /> Iniciar navegação
        </Button>
        <Button
          variant="secondary"
          disabled={nav.busy || nav.navState === "ARRIVED"}
          onClick={() => void nav.confirmArrival()}
          data-testid="task-navigation-arrived"
          className="gap-1.5"
        >
          {nav.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          {nav.navState === "ARRIVED" ? "Chegada confirmada" : "Cheguei ao local"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMinimized(true)} data-testid="task-navigation-close" className="gap-1.5">
          <X className="w-3.5 h-3.5" /> Fechar navegação (a tarefa continua)
        </Button>
      </div>

      {nav.navState === "ARRIVED" && (
        <p className="text-[11px] text-muted-foreground" data-testid="task-navigation-arrival-source">
          Chegada registrada {nav.arrivalSource === "GPS" ? "automaticamente pelo GPS" : "por confirmação sua"}; o cliente foi avisado.
        </p>
      )}

      <Dialog open={chooser} onOpenChange={setChooser}>
        <DialogContent className="sm:max-w-xs" data-testid="task-navigation-chooser">
          <DialogHeader><DialogTitle className="font-display">Abrir navegação com</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {apps.map((a) => (
              <Button key={a.id} variant="outline" className="w-full justify-start gap-2"
                onClick={() => void launch(a)} data-testid={`task-navigation-app-${a.id}`}>
                <Navigation className="w-4 h-4" /> {a.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TaskNavigationPanel;
