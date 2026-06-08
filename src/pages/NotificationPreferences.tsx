import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

type Prefs = {
  insurance_status_email: boolean;
  insurance_status_inapp: boolean;
  insurance_comment_email: boolean;
  insurance_comment_inapp: boolean;
  admin_insurance_status_email: boolean;
  admin_insurance_status_inapp: boolean;
  admin_insurance_comment_email: boolean;
  admin_insurance_comment_inapp: boolean;
};

const DEFAULTS: Prefs = {
  insurance_status_email: true,
  insurance_status_inapp: true,
  insurance_comment_email: true,
  insurance_comment_inapp: true,
  admin_insurance_status_email: true,
  admin_insurance_status_inapp: true,
  admin_insurance_comment_email: false,
  admin_insurance_comment_inapp: true,
};

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: pid } = await supabase.rpc("get_my_profile_id");
      setProfileId(pid as any);
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
        setIsAdmin((roles || []).some((r: any) => r.role === "admin"));
      }
      if (pid) {
        const { data } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("profile_id", pid as any)
          .maybeSingle();
        if (data) setPrefs({ ...DEFAULTS, ...data });
      }
      setLoading(false);
    })();
  }, []);

  const toggle = (k: keyof Prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    if (!profileId) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ profile_id: profileId, ...prefs }, { onConflict: "profile_id" });
    setSaving(false);
    if (error) toast.error("Falha ao salvar: " + error.message);
    else toast.success("Preferências atualizadas");
  };

  if (loading) return <div className="p-6">Carregando…</div>;

  const Row = ({ label, kEmail, kInApp }: { label: string; kEmail: keyof Prefs; kInApp: keyof Prefs }) => (
    <div className="flex items-center justify-between border-b py-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-6">
        <Label className="flex items-center gap-2 text-xs">
          <Switch checked={prefs[kEmail]} onCheckedChange={() => toggle(kEmail)} />
          E-mail
        </Label>
        <Label className="flex items-center gap-2 text-xs">
          <Switch checked={prefs[kInApp]} onCheckedChange={() => toggle(kInApp)} />
          In-app
        </Label>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Preferências de notificação</h1>

      <Card>
        <CardHeader><CardTitle>Sinistros (como usuário)</CardTitle></CardHeader>
        <CardContent>
          <Row label="Mudanças de status" kEmail="insurance_status_email" kInApp="insurance_status_inapp" />
          <Row label="Comentários de admin na timeline" kEmail="insurance_comment_email" kInApp="insurance_comment_inapp" />
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Sinistros (como admin)</CardTitle></CardHeader>
          <CardContent>
            <Row label="Mudanças de status em qualquer sinistro" kEmail="admin_insurance_status_email" kInApp="admin_insurance_status_inapp" />
            <Row label="Novos comentários em qualquer sinistro" kEmail="admin_insurance_comment_email" kInApp="admin_insurance_comment_inapp" />
          </CardContent>
        </Card>
      )}

      <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar preferências"}</Button>
    </div>
  );
}
