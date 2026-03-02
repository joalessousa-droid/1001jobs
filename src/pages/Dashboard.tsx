import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import { User, MapPin, Phone, Save, LogOut, Shield, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AvatarUpload from "@/components/dashboard/AvatarUpload";
import PortfolioManager from "@/components/dashboard/PortfolioManager";
import LocationPicker from "@/components/dashboard/LocationPicker";
import AppointmentList from "@/components/scheduling/AppointmentList";

interface Profile {
  id: string;
  display_name: string;
  user_type: "client" | "provider";
  bio: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  verification_status: string;
  latitude: number | null;
  longitude: number | null;
}

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .single();

    if (data) {
      setProfile(data as Profile);
      setDisplayName(data.display_name || "");
      setBio(data.bio || "");
      setPhone(data.phone || "");
      setCity(data.city || "");
      setState(data.state || "");
      setAvatarUrl(data.avatar_url || null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio,
        phone,
        city,
        state,
      })
      .eq("id", profile.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado!" });
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-6 pt-24 pb-16 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {user && profile && (
              <AvatarUpload
                userId={user.id}
                profileId={profile.id}
                displayName={displayName}
                currentUrl={avatarUrl}
                onUploaded={(url) => setAvatarUrl(url)}
              />
            )}
            <div>
              <h1 className="text-3xl font-bold font-display">Meu Perfil</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  profile?.user_type === "provider"
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-secondary-foreground"
                }`}>
                  {profile?.user_type === "provider" ? "Profissional" : "Cliente"}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  <Shield className="w-3 h-3" />
                  {profile?.verification_status === "verified" ? "Verificado" : "Não verificado"}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-card border border-border space-y-5">
            <div>
              <Label htmlFor="name" className="flex items-center gap-2 mb-1.5">
                <User className="w-4 h-4 text-muted-foreground" />
                Nome
              </Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-12 bg-background border-border"
              />
            </div>

            <div>
              <Label htmlFor="bio" className="mb-1.5 block">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="bg-background border-border min-h-[100px]"
                placeholder="Conte um pouco sobre você..."
              />
            </div>

            <div>
              <Label htmlFor="phone" className="flex items-center gap-2 mb-1.5">
                <Phone className="w-4 h-4 text-muted-foreground" />
                Telefone
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 bg-background border-border"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="flex items-center gap-2 mb-1.5">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Cidade
                </Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-12 bg-background border-border"
                />
              </div>
              <div>
                <Label htmlFor="state" className="mb-1.5 block">Estado</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="h-12 bg-background border-border"
                  placeholder="SP"
                />
          </div>

          {profile?.user_type === "provider" && user && (
            <div className="p-6 rounded-2xl bg-card border border-border space-y-5">
              <LocationPicker
                profileId={profile.id}
                currentLat={profile.latitude ?? null}
                currentLng={profile.longitude ?? null}
                onUpdated={(lat, lng) => setProfile((p) => p ? { ...p, latitude: lat, longitude: lng } : p)}
              />
            </div>
          )}

          {profile?.user_type === "provider" && user && (
            <div className="p-6 rounded-2xl bg-card border border-border">
              <PortfolioManager userId={user.id} profileId={profile.id} />
            </div>
          )}

          {/* Appointments section */}
          {profile && (
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2 mb-4">
                <CalendarIcon className="w-4 h-4" />
                Agendamentos
              </h3>
              <AppointmentList profileId={profile.id} userType={profile.user_type} />
            </div>
          )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
