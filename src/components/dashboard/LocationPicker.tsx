import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MapPin, LocateFixed, CheckCircle } from "lucide-react";

interface LocationPickerProps {
  profileId: string;
  currentLat: number | null;
  currentLng: number | null;
  onUpdated: (lat: number, lng: number) => void;
}

const LocationPicker = ({ profileId, currentLat, currentLng, onUpdated }: LocationPickerProps) => {
  const { toast } = useToast();
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    currentLat && currentLng ? { lat: currentLat, lng: currentLng } : null
  );

  const fetchLocationByIP = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      if (data.latitude && data.longitude) {
        setCoords({ lat: data.latitude, lng: data.longitude });
        toast({ title: "Localização estimada via IP!" });
        return true;
      }
    } catch {}
    return false;
  };

  const requestLocation = async () => {
    setLocating(true);

    // Try IP-based first (no permission needed)
    const ipSuccess = await fetchLocationByIP();
    if (ipSuccess) {
      setLocating(false);
      return;
    }

    // Fallback to browser geolocation
    if (!navigator.geolocation) {
      setLocating(false);
      toast({ title: "Não foi possível obter localização", variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast({ title: "Localização capturada!" });
      },
      () => {
        setLocating(false);
        toast({ title: "Não foi possível obter localização", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveLocation = async () => {
    if (!coords) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Erro ao salvar localização", description: error.message, variant: "destructive" });
    } else {
      onUpdated(coords.lat, coords.lng);
      toast({ title: "Localização salva com sucesso!" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        Localização no mapa
      </label>

      {coords && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
          <CheckCircle className="w-3.5 h-3.5 text-primary" />
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={requestLocation}
          disabled={locating}
          className="gap-1.5 text-xs"
        >
          <LocateFixed className={`w-3.5 h-3.5 ${locating ? "animate-spin" : ""}`} />
          {locating ? "Localizando..." : "Usar minha localização"}
        </Button>

        {coords && (
          <Button
            type="button"
            size="sm"
            onClick={saveLocation}
            disabled={saving}
            className="gap-1.5 text-xs"
          >
            {saving ? "Salvando..." : "Salvar localização"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default LocationPicker;
