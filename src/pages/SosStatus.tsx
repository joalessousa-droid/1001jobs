import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Clock, MapPin, Siren, Loader2, CheckCircle2, Circle, AlertCircle, XCircle, ShieldAlert } from "lucide-react";

interface EmergencyAlert {
  id: string;
  protocol: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  triggered_at: string;
  acknowledged_at: string | null;
  closed_at: string | null;
  notes: string | null;
}

const statusLabel: Record<string, string> = {
  open: "Aguardando atendimento",
  acknowledged: "Em atendimento",
  closed: "Finalizado",
  cancelled: "Cancelado pelo usuário",
};

const statusColor: Record<string, string> = {
  open: "bg-amber-500 hover:bg-amber-600",
  acknowledged: "bg-blue-500 hover:bg-blue-600",
  closed: "bg-green-500 hover:bg-green-600",
  cancelled: "bg-zinc-500 hover:bg-zinc-600",
};

const HOLD_MS = 1500;
const CONFIRM_PHRASE = "CANCELAR";

export default function SosStatus() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<EmergencyAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [holdProgress, setHoldProgress] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const holdStart = useRef<number>(0);

  const phraseOk = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;
  const isActive = !!alert && !["closed", "cancelled"].includes(alert.status);

  function startHold() {
    if (!phraseOk || cancelling) return;
    holdStart.current = Date.now();
    setHoldProgress(0);
    const tick = () => {
      const p = Math.min(1, (Date.now() - holdStart.current) / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        stopHold(false);
        void doCancel();
      } else {
        holdTimer.current = window.requestAnimationFrame(tick);
      }
    };
    holdTimer.current = window.requestAnimationFrame(tick);
  }

  function stopHold(reset = true) {
    if (holdTimer.current) cancelAnimationFrame(holdTimer.current);
    holdTimer.current = null;
    if (reset) setHoldProgress(0);
  }

  async function doCancel() {
    if (!alert) return;
    setCancelling(true);
    const { data, error } = await supabase.rpc("cancel_emergency_alert", {
      _alert_id: alert.id,
      _reason: reason || null,
    });
    setCancelling(false);
    if (error) {
      toast.error("Não foi possível cancelar", { description: error.message });
      return;
    }
    if (data) setAlert(data as any);
    toast.success("Solicitação SOS cancelada");
    setConfirmOpen(false);
    setReason("");
    setConfirmText("");
    setHoldProgress(0);
  }

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("emergency_alerts")
        .select("id, protocol, status, latitude, longitude, accuracy_meters, triggered_at, acknowledged_at, closed_at, notes")
        .eq("user_id", user.id)
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAlert(data as any);
      setLoading(false);
    }

    load();

    // Realtime updates para o alerta mais recente do usuário
    const ch = supabase
      .channel("my-emergency-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "emergency_alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any;
          setAlert((prev) => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergency_alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setAlert(payload.new as any);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Timer do disparo
  useEffect(() => {
    if (!alert) return;
    setElapsed(Math.floor((Date.now() - new Date(alert.triggered_at).getTime()) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(alert.triggered_at).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [alert?.triggered_at]);

  const formattedElapsed = useMemo(() => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    if (h > 0) return `${h}h ${m}min ${s}s`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
  }, [elapsed]);

  const steps = useMemo(() => {
    const s = alert?.status ?? "";
    return [
      { key: "open", label: "Enviado", done: true, active: s === "open" },
      { key: "acknowledged", label: "Reconhecido", done: s === "acknowledged" || s === "closed", active: s === "acknowledged" },
      { key: "closed", label: "Finalizado", done: s === "closed", active: s === "closed" },
    ];
  }, [alert?.status]);

  const mapsUrl = alert?.latitude != null && alert?.longitude != null
    ? `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`
    : null;

  const embedMapUrl = alert?.latitude != null && alert?.longitude != null
    ? `https://maps.google.com/maps?q=${alert.latitude},${alert.longitude}&z=15&output=embed`
    : null;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Faça login para visualizar o status do SOS.</p>
        <Button onClick={() => navigate("/auth")}>Entrar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold truncate flex items-center gap-2">
            <Siren className="w-5 h-5 text-red-500" /> Status da emergência
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !alert ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Nenhuma solicitação SOS encontrada.</p>
              <Button variant="outline" onClick={() => navigate("/")}>Voltar ao início</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Protocolo e status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Siren className="h-4 w-4 text-red-500" /> Protocolo {alert.protocol}
                  </span>
                  <Badge className={statusColor[alert.status] ?? "bg-muted"}>
                    {statusLabel[alert.status] ?? alert.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Disparado em {new Date(alert.triggered_at).toLocaleString("pt-BR")}</span>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-red-500">⏱</span>
                  <span>Tempo decorrido: {formattedElapsed}</span>
                </div>

                <Separator />

                {/* Steps */}
                <div className="flex items-center justify-between">
                  {steps.map((step, idx) => (
                    <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                      {step.done ? (
                        <CheckCircle2 className={`w-6 h-6 ${step.active ? "text-blue-500" : "text-green-500"}`} />
                      ) : (
                        <Circle className="w-6 h-6 text-muted-foreground" />
                      )}
                      <span className={`text-xs ${step.active ? "font-semibold text-foreground" : step.done ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                        {step.label}
                      </span>
                      {idx < steps.length - 1 && (
                        <div className="absolute w-full h-px bg-border left-1/2 top-3 -z-10 hidden" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Linha progresso visual */}
                <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-500 via-blue-500 to-green-500 transition-all duration-700"
                    style={{
                      width: alert.status === "closed" ? "100%" : alert.status === "acknowledged" ? "66%" : "33%",
                    }}
                  />
                </div>

                {alert.notes && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Observações da central</p>
                    <p>{alert.notes}</p>
                  </div>
                )}

                {isActive && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
                        onClick={() => setConfirmOpen(true)}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancelar solicitação SOS
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center">
                        Use apenas se a emergência foi resolvida ou disparada por engano.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <AlertDialog
              open={confirmOpen}
              onOpenChange={(o) => {
                setConfirmOpen(o);
                if (!o) {
                  stopHold();
                  setConfirmText("");
                  setReason("");
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" /> Cancelar solicitação SOS?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação encerra o atendimento de emergência em andamento. Só prossiga se a situação foi resolvida ou foi um disparo acidental.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ex.: disparo acidental, situação já resolvida..."
                      maxLength={300}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Para confirmar, digite <span className="font-bold text-red-600">{CONFIRM_PHRASE}</span>
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <AlertDialogFooter className="gap-2 sm:gap-2">
                  <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
                  <button
                    type="button"
                    disabled={!phraseOk || cancelling}
                    onMouseDown={startHold}
                    onMouseUp={() => stopHold()}
                    onMouseLeave={() => stopHold()}
                    onTouchStart={startHold}
                    onTouchEnd={() => stopHold()}
                    onTouchCancel={() => stopHold()}
                    className="relative overflow-hidden inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed select-none"
                  >
                    <span
                      className="absolute inset-y-0 left-0 bg-red-800/60 transition-[width] duration-75"
                      style={{ width: `${holdProgress * 100}%` }}
                    />
                    <span className="relative flex items-center">
                      {cancelling ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      {cancelling ? "Cancelando..." : "Segure para confirmar"}
                    </span>
                  </button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Mapa / Localização */}
            {embedMapUrl ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Localização do disparo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden rounded-b-lg">
                  <iframe
                    title="Localização do SOS"
                    src={embedMapUrl}
                    className="w-full h-64 border-0"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="p-4 text-sm space-y-1">
                    <p><b>Lat:</b> {alert.latitude?.toFixed(5)} · <b>Lng:</b> {alert.longitude?.toFixed(5)}</p>
                    {alert.accuracy_meters != null && (
                      <p className="text-muted-foreground text-xs">Precisão: ±{alert.accuracy_meters}m</p>
                    )}
                    <Button size="sm" variant="outline" className="mt-2" asChild>
                      <a href={mapsUrl!} target="_blank" rel="noreferrer">Abrir no Google Maps</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Sem dados de localização para este alerta.
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
