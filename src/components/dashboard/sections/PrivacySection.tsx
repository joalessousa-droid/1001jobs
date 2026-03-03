import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Bell, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PrivacySection = () => {
  const { toast } = useToast();
  const [profilePublic, setProfilePublic] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  const handleToggle = (label: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    toast({ title: `${label} ${value ? "ativado" : "desativado"}` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Privacidade</h2>
        <p className="text-muted-foreground text-sm mt-1">Controle suas preferências de privacidade</p>
      </div>

      <Card className="p-6 bg-card border-border space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-foreground font-medium">Perfil público</Label>
              <p className="text-xs text-muted-foreground">Seu perfil é visível na busca</p>
            </div>
          </div>
          <Switch checked={profilePublic} onCheckedChange={(v) => handleToggle("Perfil público", v, setProfilePublic)} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-foreground font-medium">Exibir telefone</Label>
              <p className="text-xs text-muted-foreground">Mostrar telefone no perfil público</p>
            </div>
          </div>
          <Switch checked={showPhone} onCheckedChange={(v) => handleToggle("Exibir telefone", v, setShowPhone)} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-foreground font-medium">Notificações por e-mail</Label>
              <p className="text-xs text-muted-foreground">Receber atualizações por e-mail</p>
            </div>
          </div>
          <Switch checked={emailNotifications} onCheckedChange={(v) => handleToggle("Notificações por e-mail", v, setEmailNotifications)} />
        </div>
      </Card>
    </div>
  );
};

export default PrivacySection;
