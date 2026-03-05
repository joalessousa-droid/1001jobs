import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, Bell, Globe, FileText, Clock, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string | null;
  details: Record<string, any>;
  created_at: string;
}

interface Consent {
  id: string;
  consent_type: string;
  consent_version: string;
  accepted: boolean;
  created_at: string;
  revoked_at: string | null;
}

const actionLabels: Record<string, string> = {
  signup: "Cadastro realizado",
  login: "Login",
  profile_update: "Perfil atualizado",
  kyc_upload: "Documento KYC enviado",
  consent_given: "Consentimento dado",
  consent_revoked: "Consentimento revogado",
  password_change: "Senha alterada",
  data_export: "Dados exportados",
  data_deletion: "Dados excluídos",
};

const consentLabels: Record<string, string> = {
  terms: "Termos de Uso",
  privacy: "Política de Privacidade",
  data_processing: "Tratamento de Dados",
  marketing: "Comunicações de Marketing",
};

const PrivacySection = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [profilePublic, setProfilePublic] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Fetch consents
    supabase
      .from("lgpd_consents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setConsents((data as unknown as Consent[]) || []));
  }, [user]);

  const loadAuditLogs = async () => {
    if (!user) return;
    setShowLogs(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setAuditLogs((data as unknown as AuditLog[]) || []);
  };

  const handleToggle = (label: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    toast({ title: `${label} ${value ? "ativado" : "desativado"}` });
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  // Deduplicate consents by type (latest only)
  const latestConsents = Object.values(
    consents.reduce((acc, c) => {
      if (!acc[c.consent_type] || new Date(c.created_at) > new Date(acc[c.consent_type].created_at)) {
        acc[c.consent_type] = c;
      }
      return acc;
    }, {} as Record<string, Consent>)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Privacidade</h2>
        <p className="text-muted-foreground text-sm mt-1">Controle suas preferências de privacidade e dados</p>
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

      {/* LGPD Consents */}
      {latestConsents.length > 0 && (
        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Consentimentos LGPD</h3>
          </div>
          <div className="space-y-3">
            {latestConsents.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{consentLabels[c.consent_type] || c.consent_type}</p>
                  <p className="text-xs text-muted-foreground">v{c.consent_version} · {formatDate(c.created_at)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${c.accepted && !c.revoked_at ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {c.accepted && !c.revoked_at ? "Ativo" : "Revogado"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Audit Logs */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Logs de Auditoria</h3>
          </div>
          {!showLogs && (
            <Button variant="outline" size="sm" onClick={loadAuditLogs} className="gap-2">
              <Clock className="w-3 h-3" /> Ver histórico
            </Button>
          )}
        </div>

        {showLogs && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{actionLabels[log.action] || log.action}</p>
                    {log.entity_type && (
                      <p className="text-xs text-muted-foreground">{log.entity_type}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {!showLogs && (
          <p className="text-sm text-muted-foreground">
            Visualize o histórico completo de ações realizadas na sua conta para transparência e conformidade LGPD.
          </p>
        )}
      </Card>
    </div>
  );
};

export default PrivacySection;
