// Diálogo imperativo de confirmação de ação crítica (senha + selfie real opcional).
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldAlert } from "lucide-react";
import { WebcamCapture } from "@/components/security/WebcamCapture";

export type CriticalContext = "withdrawal" | "password_change" | "suspicious_login" | "payment" | "sensitive_change";

interface Props {
  open: boolean;
  context: CriticalContext;
  requireFace?: boolean;
  onResolved: (ok: boolean) => void;
}

// Mapeia contexto interno do dialog para o contexto aceito pelo edge function face-verify.
function faceContext(c: CriticalContext): "login" | "payment" | "withdrawal" | "sensitive_change" | "kyc" {
  if (c === "withdrawal") return "withdrawal";
  if (c === "payment") return "payment";
  if (c === "suspicious_login") return "login";
  return "sensitive_change";
}

export function CriticalActionDialog({ open, context, requireFace, onResolved }: Props) {
  const [password, setPassword] = useState("");
  const [selfie, setSelfie] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() { setPassword(""); setSelfie(""); setError(null); }

  async function confirm() {
    setLoading(true); setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) { setError("Sessão expirada"); return; }
      const { error: se } = await supabase.auth.signInWithPassword({ email, password });
      if (se) { setError("Senha incorreta"); return; }

      if (requireFace) {
        if (!selfie) { setError("Capture sua selfie para continuar"); return; }
        const { data, error: fe } = await supabase.functions.invoke("face-verify", {
          body: { context: faceContext(context), selfie_base64: selfie },
        });
        if (fe) {
          setError("Verificação facial indisponível — ação bloqueada por segurança");
          onResolved(false); return;
        }
        const decision = (data as any)?.decision;
        if (decision === "blocked") {
          setError("Ação bloqueada por divergência biométrica");
          onResolved(false); return;
        }
        if (decision === "review") {
          setError("Verificação facial inconclusiva — ação bloqueada para revisão");
          onResolved(false); return;
        }
      }
      reset();
      onResolved(true);
    } catch (e: any) {
      setError(e?.message ?? "Erro");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onResolved(false); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Confirmação de segurança
          </DialogTitle>
          <DialogDescription>
            Esta é uma ação sensível ({context}). Confirme sua senha para continuar.
            {requireFace && " Também verificaremos sua identidade por selfie."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ca-pwd">Senha atual</Label>
            <Input id="ca-pwd" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !requireFace && confirm()} autoFocus />
          </div>
          {requireFace && (
            <div>
              <Label>Selfie ao vivo</Label>
              <WebcamCapture captured={selfie} onCapture={setSelfie} />
            </div>
          )}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { reset(); onResolved(false); }} disabled={loading}>Cancelar</Button>
            <Button onClick={confirm} disabled={loading || !password || (requireFace && !selfie)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
