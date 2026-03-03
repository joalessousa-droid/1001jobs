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
import { useTranslation } from "react-i18next";

interface Category { id: string; name: string; }
interface CreateServiceRequestProps { categories: Category[]; onCreated: () => void; }

const CreateServiceRequest = ({ categories, onCreated }: CreateServiceRequestProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [form, setForm] = useState({ description: "", category_id: "", budget: "", city: "", state: "", requester_type: "person" });

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, city, state").eq("user_id", user.id).maybeSingle();
      if (data) {
        setProfileId(data.id);
        setForm((prev) => ({ ...prev, city: data.city || "", state: data.state || "" }));
      }
    };
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) { toast.error(t("search.profileError")); return; }
    if (!form.description.trim() || !form.category_id) { toast.error(t("search.fillRequired")); return; }
    if (form.description.trim().length > 500) { toast.error(t("search.descMaxLength")); return; }

    setLoading(true);
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", profileId).single();
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

    if (error) { toast.error(t("search.demandError")); return; }

    toast.success(t("search.demandCreated"));
    setForm({ description: "", category_id: "", budget: "", city: "", state: "", requester_type: "person" });
    setOpen(false);
    onCreated();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" />{t("search.newDemand")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("search.publishDemand")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>{t("search.categoryRequired")}</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder={t("search.selectCategory")} /></SelectTrigger>
              <SelectContent>{categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("search.descriptionRequired")}</Label>
            <Textarea placeholder={t("search.descriptionPlaceholder")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={4} />
            <p className="text-xs text-muted-foreground text-right">{form.description.length}/500</p>
          </div>
          <div className="space-y-2">
            <Label>{t("search.requesterType")}</Label>
            <Select value={form.requester_type} onValueChange={(v) => setForm({ ...form, requester_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="person">{t("search.individual")}</SelectItem>
                <SelectItem value="company">{t("search.company")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("search.budget")}</Label>
            <Input type="number" min="0" step="0.01" placeholder={t("search.budgetPlaceholder")} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("search.city")}</Label>
              <Input placeholder={t("search.cityPlaceholder")} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>{t("search.state")}</Label>
              <Input placeholder={t("search.statePlaceholder")} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("search.publishing") : t("search.publishDemandBtn")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateServiceRequest;
