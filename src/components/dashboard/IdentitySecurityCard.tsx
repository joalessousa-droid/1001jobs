// Etapa 5 — Identidade: verificação em duas etapas (app autenticador) e
// controle de sessões. Tudo opcional; o login atual continua igual.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, LogOut, ShieldCheck } from "lucide-react";

type Factor = { id: string; status: string; friendly_name?: string | null };

const IdentitySecurityCard = () => {
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const verified = factors.find((f) => f.status === "verified");

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `1001Jobs ${Date.now()}` });
    setBusy(false);
    if (error || !data) return toast({ title: "Não foi possível iniciar", description: "Tente novamente em instantes.", variant: "destructive" });
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirm = async () => {
    if (!enroll) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    setBusy(false);
    if (error) return toast({ title: "Código inválido", variant: "destructive" });
    toast({ title: "Verificação em duas etapas ativada" });
    setEnroll(null); setCode(""); void load();
  };

  const disable = async () => {
    if (!verified) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    if (error) return toast({ title: "Confirme sua identidade com o código antes de desativar", variant: "destructive" });
    toast({ title: "Verificação em duas etapas desativada" }); void load();
  };

  const signOutOthers = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    toast(error ? { title: "Erro ao encerrar sessões", variant: "destructive" } : { title: "Outros dispositivos foram desconectados" });
  };

  return (
    <Card className="p-6 bg-card border-border space-y-4" data-testid="identity-security-card">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-foreground">Verificação em duas etapas</p>
          <p className="text-xs text-muted-foreground">
            {verified ? "Ativa — um código do app autenticador é pedido no login." : "Opcional. Use Google Authenticator, Authy ou similar."}
          </p>
        </div>
      </div>

      {enroll ? (
        <div className="space-y-3">
          <img src={enroll.qr} alt="QR code para o app autenticador" className="w-40 h-40 bg-background rounded-md p-2" />
          <p className="text-xs text-muted-foreground break-all">Chave manual: {enroll.secret}</p>
          <Input inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" value={code} onChange={(e) => setCode(e.target.value)} className="h-12 bg-background" />
          <div className="flex gap-2">
            <Button onClick={confirm} disabled={busy || code.trim().length !== 6} className="gap-2"><ShieldCheck className="w-4 h-4" />Confirmar</Button>
            <Button variant="ghost" onClick={() => { setEnroll(null); setCode(""); }}>Cancelar</Button>
          </div>
        </div>
      ) : verified ? (
        <Button variant="outline" onClick={disable} disabled={busy}>Desativar</Button>
      ) : (
        <Button onClick={start} disabled={busy} data-testid="mfa-enroll">Ativar</Button>
      )}

      <div className="border-t border-border pt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Saia da sua conta em todos os outros aparelhos.</p>
        <Button variant="outline" size="sm" onClick={signOutOthers} className="gap-2" data-testid="signout-others">
          <LogOut className="w-4 h-4" />Encerrar outras sessões
        </Button>
      </div>
    </Card>
  );
};

export default IdentitySecurityCard;
