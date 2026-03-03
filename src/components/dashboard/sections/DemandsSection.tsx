import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Props {
  profileId: string;
}

const DemandsSection = ({ profileId }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [demands, setDemands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDemands = async () => {
    const { data } = await supabase
      .from("service_requests")
      .select("*, service_categories(name)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    setDemands(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDemands(); }, [profileId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("service_requests").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Demanda removida" }); fetchDemands(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Minhas Demandas</h2>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas solicitações de serviço</p>
        </div>
        <Button onClick={() => navigate("/buscar?mode=provider")} className="gap-2"><Plus className="w-4 h-4" /> Nova demanda</Button>
      </div>

      {demands.length === 0 ? (
        <Card className="p-8 bg-card border-border text-center">
          <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma demanda criada</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/buscar?mode=provider")}>Criar primeira demanda</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {demands.map((d) => (
            <Card key={d.id} className="p-4 bg-card border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">{d.service_categories?.name || "Categoria"}</Badge>
                    <Badge variant={d.is_active ? "default" : "outline"} className="text-xs">{d.is_active ? "Ativa" : "Inativa"}</Badge>
                  </div>
                  <p className="text-sm text-foreground">{d.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {d.budget && <span>Orçamento: R$ {d.budget}</span>}
                    {d.city && <span>{d.city}/{d.state}</span>}
                    <span>{new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(d.id)}>
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

export default DemandsSection;
