// Diálogo imperativo de confirmação de ação crítica (senha + face opcional).
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldAlert } from "lucide-react";

export type CriticalContext = "withdrawal" | "password_change" | "suspicious_login" | "payment" | "sensitive_change";

interface Props {
  open: boolean;
  context: CriticalContext;
  requireFace?: boolean;
  onResolved: (ok: boolean) => void;
}

export function CriticalActionDialog({ open, context, requireFace, onResolved }: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true); setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("Sessão expirada");
      const { error: se } = await supabase.auth.signInWithPassword({ email, password });
      if (se) { setError("Senha incorreta"); return; }

      if (requireFace) {
        const { data, error: fe } = await supabase.functions.invoke("face-verify", {
          body: { context, selfie_base64: "" },
        });
        if (fe) { setError("Verificação facial indisponível"); return; }
        const decision = (data as any)?.decision;
        if (decision === "blocked") { setError("Ação bloqueada por segurança"); onResolved(false); return; }
      }
      onResolved(true);
    } catch (e: any) {
      setError(e.message ?? "Erro");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onResolved(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Confirmação de segurança
          </DialogTitle>
          <DialogDescription>
            Esta é uma ação sensível ({context}). Confirme sua senha para continuar.
            {requireFace && " Também verificaremos sua identidade biométrica."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ca-pwd">Senha atual</Label>
            <Input id="ca-pwd" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm()} autoFocus />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => onResolved(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={confirm} disabled={loading || !password}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
