import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Key, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import RiskScoreCard from "@/components/dashboard/RiskScoreCard";
import { useCriticalAction } from "@/hooks/useCriticalAction";

const SecuritySection = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "Use no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Segurança</h2>
        <p className="text-muted-foreground text-sm mt-1">Proteja sua conta</p>
      </div>

      <Card className="p-6 bg-card border-border space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">Alterar Senha</p>
            <p className="text-xs text-muted-foreground">Recomendamos alterar sua senha regularmente</p>
          </div>
        </div>

        <div>
          <Label htmlFor="new-pass" className="mb-1.5 block">Nova senha</Label>
          <Input id="new-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 bg-background border-border" placeholder="Mínimo 6 caracteres" />
        </div>
        <div>
          <Label htmlFor="confirm-pass" className="mb-1.5 block">Confirmar nova senha</Label>
          <Input id="confirm-pass" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 bg-background border-border" />
        </div>

        <Button onClick={handleChangePassword} disabled={saving} className="gap-2">
          <Shield className="w-4 h-4" />
          {saving ? "Salvando..." : "Alterar senha"}
        </Button>
      </Card>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">Verificação por E-mail</p>
            <p className="text-xs text-muted-foreground">Sua conta está protegida com verificação de e-mail OTP</p>
          </div>
        </div>
      </Card>

      {user && <RiskScoreCard userId={user.id} />}
    </div>
  );
};

export default SecuritySection;
