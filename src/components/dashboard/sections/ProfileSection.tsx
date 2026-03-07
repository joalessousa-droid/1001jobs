import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, MapPin, Phone, Save, Shield } from "lucide-react";
import ProBadge from "@/components/ProBadge";
import AvatarUpload from "@/components/dashboard/AvatarUpload";
import PortfolioManager from "@/components/dashboard/PortfolioManager";
import LocationPicker from "@/components/dashboard/LocationPicker";

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

interface Props {
  profile: Profile;
  userId: string;
  onProfileUpdate: (p: Partial<Profile>) => void;
}

const ProfileSection = ({ profile, userId, onProfileUpdate }: Props) => {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [city, setCity] = useState(profile.city || "");
  const [state, setState] = useState(profile.state || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio, phone, city, state })
      .eq("id", profile.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado!" });
      onProfileUpdate({ display_name: displayName, bio, phone, city, state });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <AvatarUpload
          userId={userId}
          profileId={profile.id}
          displayName={displayName}
          currentUrl={avatarUrl}
          onUploaded={(url) => { setAvatarUrl(url); onProfileUpdate({ avatar_url: url }); }}
        />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold font-display">Meu Perfil</h2>
            <ProBadge profileId={profile.id} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              profile.user_type === "provider" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
            }`}>
              {profile.user_type === "provider" ? "Profissional" : "Cliente"}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              <Shield className="w-3 h-3" />
              {profile.verification_status === "verified" ? "Verificado" : "Não verificado"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border space-y-5">
        <div>
          <Label htmlFor="name" className="flex items-center gap-2 mb-1.5">
            <User className="w-4 h-4 text-muted-foreground" /> Nome
          </Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-12 bg-background border-border" />
        </div>
        <div>
          <Label htmlFor="bio" className="mb-1.5 block">Bio</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} className="bg-background border-border min-h-[100px]" placeholder="Conte um pouco sobre você..." />
        </div>
        <div>
          <Label htmlFor="phone" className="flex items-center gap-2 mb-1.5">
            <Phone className="w-4 h-4 text-muted-foreground" /> Telefone
          </Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 bg-background border-border" placeholder="(11) 99999-9999" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city" className="flex items-center gap-2 mb-1.5">
              <MapPin className="w-4 h-4 text-muted-foreground" /> Cidade
            </Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="h-12 bg-background border-border" />
          </div>
          <div>
            <Label htmlFor="state" className="mb-1.5 block">Estado</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} className="h-12 bg-background border-border" placeholder="SP" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      {profile.user_type === "provider" && (
        <>
          <div className="p-6 rounded-2xl bg-card border border-border">
            <LocationPicker
              profileId={profile.id}
              currentLat={profile.latitude ?? null}
              currentLng={profile.longitude ?? null}
              onUpdated={(lat, lng) => onProfileUpdate({ latitude: lat, longitude: lng })}
            />
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border">
            <PortfolioManager userId={userId} profileId={profile.id} />
          </div>
        </>
      )}
    </div>
  );
};

export default ProfileSection;
