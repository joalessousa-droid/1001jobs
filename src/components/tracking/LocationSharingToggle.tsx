import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { useProviderLocationSharing } from "@/hooks/useProviderLocationSharing";
import { supabase } from "@/integrations/supabase/client";

interface Props { providerId: string; }

const LocationSharingToggle = ({ providerId }: Props) => {
  const [enabled, setEnabled] = useState(false);
  const { error, last } = useProviderLocationSharing({ providerId, enabled, intervalMs: 5000 });

  // hydrate initial state
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("provider_locations" as any).select("is_sharing").eq("provider_id", providerId).maybeSingle();
      if (data && (data as any).is_sharing) setEnabled(true);
    })();
  }, [providerId]);

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="loc-share" className="flex items-center gap-2 font-semibold">
            <MapPin className="w-4 h-4 text-primary" /> Compartilhar localização em tempo real
          </Label>
          <p className="text-xs text-muted-foreground">
            Quando ativo, clientes de serviços aceitos podem ver sua posição no mapa enquanto você se desloca.
            Atualização a cada 5 segundos.
          </p>
        </div>
        <Switch id="loc-share" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {enabled && last && (
        <p className="text-xs text-muted-foreground">
          Última posição: {last.latitude.toFixed(5)}, {last.longitude.toFixed(5)}
          {last.accuracy ? ` · ±${Math.round(last.accuracy)}m` : ""}
        </p>
      )}
    </Card>
  );
};

export default LocationSharingToggle;
