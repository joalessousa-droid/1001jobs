import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AvatarUpload from "@/components/dashboard/AvatarUpload";
import FavoriteProvidersCard from "@/components/providers/FavoriteProvidersCard";
import RecurringServicesPanel from "@/components/services/RecurringServicesPanel";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Radar, Receipt, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  user_type: string | null;
}

interface HistoryRow {
  id: string;
  title: string;
  status: string;
  payment_status: string;
  agreed_price: number | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  accepted: "Aceito",
  in_progress: "Em andamento",
  completed: "Concluído",
  confirmed: "Confirmado",
  disputed: "Em disputa",
  refunded: "Reembolsado",
  cancelled_by_client: "Cancelado por você",
  cancelled_by_provider: "Cancelado pelo profissional",
};

const brl = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ClientProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, bio, phone, city, state, avatar_url, user_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const p = (data ?? null) as ProfileRow | null;
      setProfile(p);
      if (p) {
        const { data: svcs } = await supabase
          .from("services")
          .select("id, title, status, payment_status, agreed_price, created_at")
          .eq("client_id", p.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!cancelled) setHistory((svcs ?? []) as HistoryRow[]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name,
        bio: profile.bio,
        phone: profile.phone,
        city: profile.city,
        state: profile.state,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) toast.error("Não foi possível salvar seu perfil.");
    else toast.success("Perfil atualizado!");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16" data-testid="client-profile">
        <h1 className="text-2xl sm:text-3xl font-display font-bold mb-6">Meu perfil</h1>

        {loading || authLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !profile ? (
          <Card className="p-10 text-center text-muted-foreground">Perfil não encontrado.</Card>
        ) : (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
                <AvatarUpload
                  userId={profile.user_id}
                  profileId={profile.id}
                  displayName={profile.display_name}
                  currentUrl={profile.avatar_url}
                  onUploaded={(url) => setProfile({ ...profile, avatar_url: url })}
                />
                <div className="flex-1 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={profile.display_name ?? ""}
                      onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                      data-testid="profile-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bio">Descrição</Label>
                    <Textarea
                      id="bio"
                      rows={4}
                      placeholder="Conte um pouco sobre você e o que costuma contratar."
                      value={profile.bio ?? ""}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      data-testid="profile-bio"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={profile.phone ?? ""}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={profile.city ?? ""}
                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        value={profile.state ?? ""}
                        onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button onClick={() => void save()} disabled={saving} className="gap-2" data-testid="profile-save">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                  </Button>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button asChild variant="outline" className="gap-2">
                <Link to="/radar">
                  <Radar className="w-4 h-4" /> Chamar no Radar
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/meus-servicos">
                  <Receipt className="w-4 h-4" /> Meus serviços
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/dashboard">
                  <LayoutDashboard className="w-4 h-4" /> Painel
                </Link>
              </Button>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Histórico recente</h2>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/meus-servicos">Ver tudo</Link>
                </Button>
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Você ainda não contratou serviços.</p>
              ) : (
                <div className="space-y-3" data-testid="profile-history">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{h.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(h.created_at), "dd MMM yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">
                          {STATUS_LABEL[h.status] ?? h.status}
                        </Badge>
                        <span className="text-sm font-semibold">{brl(h.agreed_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <FavoriteProvidersCard />

            <RecurringServicesPanel />
          </div>

        )}
      </main>
      <Footer />
    </div>
  );
};

export default ClientProfile;
