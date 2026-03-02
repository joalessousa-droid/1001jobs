import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface CreateServiceRequestProps {
  categories: Category[];
  onCreated: () => void;
}

const CreateServiceRequest = ({ categories, onCreated }: CreateServiceRequestProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: "",
    category_id: "",
    budget: "",
    city: "",
    state: "",
    requester_type: "person",
  });

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, city, state")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfileId(data.id);
        setForm((prev) => ({
          ...prev,
          city: data.city || "",
          state: data.state || "",
        }));
      }
    };
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) {
      toast.error("Perfil não encontrado. Faça login novamente.");
      return;
    }
    if (!form.description.trim() || !form.category_id) {
      toast.error("Preencha a descrição e selecione uma categoria.");
      return;
    }
    if (form.description.trim().length > 500) {
      toast.error("A descrição deve ter no máximo 500 caracteres.");
      return;
    }

    setLoading(true);

    // Get display name for requester_name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", profileId)
      .single();

    const { error } = await supabase.from("service_requests").insert({
      profile_id: profileId,
      requester_name: profile?.display_name || "Usuário",
      requester_type: form.requester_type,
      description: form.description.trim(),
      category_id: form.category_id,
      budget: form.budget ? parseFloat(form.budget) : null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
    });

    setLoading(false);

    if (error) {
      toast.error("Erro ao criar demanda. Tente novamente.");
      return;
    }

    toast.success("Demanda publicada com sucesso!");
    setForm({ description: "", category_id: "", budget: "", city: "", state: "", requester_type: "person" });
    setOpen(false);
    onCreated();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Demanda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publicar Demanda de Serviço</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              placeholder="Descreva o que você precisa..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">{form.description.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de solicitante</Label>
            <Select value={form.requester_type} onValueChange={(v) => setForm({ ...form, requester_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">Pessoa física</SelectItem>
                <SelectItem value="company">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Orçamento (R$)</Label>
            <Input
              id="budget"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex: 500"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                placeholder="Ex: São Paulo"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                placeholder="Ex: SP"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                maxLength={2}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Publicando..." : "Publicar Demanda"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateServiceRequest;
