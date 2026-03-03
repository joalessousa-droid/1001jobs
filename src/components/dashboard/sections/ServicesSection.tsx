import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  profileId: string;
}

const ServicesSection = ({ profileId }: Props) => {
  const { toast } = useToast();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("provider_services")
      .select("*, service_categories(name)")
      .eq("provider_id", profileId)
      .order("created_at", { ascending: false });
    setServices(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, [profileId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("provider_services").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Serviço removido" }); fetchServices(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Meus Serviços</h2>
        <p className="text-muted-foreground text-sm mt-1">Gerencie os serviços que você oferece</p>
      </div>

      {services.length === 0 ? (
        <Card className="p-8 bg-card border-border text-center">
          <Briefcase className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <Card key={s.id} className="p-4 bg-card border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="secondary" className="text-xs mb-1">{s.service_categories?.name || "Serviço"}</Badge>
                  {s.description && <p className="text-sm text-foreground mt-1">{s.description}</p>}
                  {s.hourly_rate && <p className="text-xs text-primary font-medium mt-1">R$ {s.hourly_rate}/hora</p>}
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesSection;
