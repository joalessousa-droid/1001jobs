// Módulo 12 — Acionador de SOS. Disponível APENAS para usuários autenticados.
// Pode ser renderizado como botão flutuante (default) ou via trigger customizado
// (ex.: item no menu de perfil).
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Siren, Loader2 } from "lucide-react";
import { toast } from "sonner";

async function getPosition(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  });
}

interface SOSButtonProps {
  /** Render-prop para um trigger customizado (ex.: item de menu). Recebe `open()` para acionar o diálogo. */
  renderTrigger?: (open: () => void) => ReactNode;
}

export function SOSButton({ renderTrigger }: SOSButtonProps = {}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  if (!user) return null;

  async function fire() {
    setSending(true);
    const pos = await getPosition();
    const { data, error } = await supabase.rpc("trigger_emergency_alert", {
      _latitude: pos?.coords.latitude ?? null,
      _longitude: pos?.coords.longitude ?? null,
      _accuracy_meters: pos?.coords.accuracy ?? null,
      _context: { user_agent: navigator.userAgent, path: window.location.pathname },
    });
    setSending(false); setOpen(false);
    if (error) {
      if (String(error.message).includes("rate_limited")) {
        return toast.error("Aguarde antes de acionar outro SOS.");
      }
      return toast.error("Falha ao acionar SOS: " + error.message);
    }
    const row = data as any;
    const proto = row?.protocol ?? "—";
    toast.success(`SOS enviado. Protocolo ${proto}. A central foi notificada.`);
    if (row?.id) {
      supabase.functions.invoke("sos-notify", { body: { alert_id: row.id } }).catch(() => {});
    }
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Acionar emergência SOS"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 shadow-lg shadow-red-900/40"
        >
          <Siren className="h-5 w-5" /> SOS
        </button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acionar emergência?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua localização e horário serão registrados e enviados à central.
              Use somente em situação real de emergência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={fire} disabled={sending}
              className="bg-red-600 hover:bg-red-700 text-white">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar SOS"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
