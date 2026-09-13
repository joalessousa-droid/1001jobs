// Painel administrativo de pessoas reais (clientes e profissionais).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Search, ShieldOff, ShieldCheck, Star } from "lucide-react";

export interface AdminProfileRow {
  id: string;
  user_type: string;
  display_name: string;
  bio: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  is_synthetic: boolean;
  verification_status: string | null;
  provider_score: number | null;
  provider_tier: string | null;
  client_score: number | null;
  fraud_score: number | null;
  total_reviews: number | null;
  avg_rating: number | null;
  created_at: string;
}

const emptyForm = {
  display_name: "",
  bio: "",
  phone: "",
  city: "",
  state: "",
  avatar_url: "",
};

const AdminPeoplePanel = () => {
  const [userType, setUserType] = useState<"client" | "provider">("client");
  const [rows, setRows] = useState<AdminProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [includeSynthetic, setIncludeSynthetic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof emptyForm & { id?: string }>({ ...emptyForm });
  const [confirmDelete, setConfirmDelete] = useState<AdminProfileRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_profiles" as never, {
      _user_type: userType,
      _search: search || null,
      _city: city || null,
      _include_synthetic: includeSynthetic,
      _limit: 200,
      _offset: 0,
    } as never);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar as pessoas.");
      return;
    }
    setRows((data ?? []) as unknown as AdminProfileRow[]);
  }, [userType, search, city, includeSynthetic]);

  useEffect(() => {
    void load();
  }, [load]);

  const openForm = (p?: AdminProfileRow) => {
    setForm(
      p
        ? {
            id: p.id,
            display_name: p.display_name,
            bio: p.bio ?? "",
            phone: p.phone ?? "",
            city: p.city ?? "",
            state: p.state ?? "",
            avatar_url: p.avatar_url ?? "",
          }
        : { ...emptyForm },
    );
    setOpen(true);
  };

  const save = async () => {
    if (!form.display_name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_upsert_profile" as never, {
      _id: form.id ?? null,
      _user_type: userType,
      _display_name: form.display_name.trim(),
      _bio: form.bio || null,
      _phone: form.phone || null,
      _city: form.city || null,
      _state: form.state || null,
      _avatar_url: form.avatar_url || null,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Não foi possível salvar.");
      return;
    }
    toast.success(form.id ? "Cadastro atualizado." : "Cadastro criado.");
    setOpen(false);
    await load();
  };

  const toggleBlock = async (p: AdminProfileRow) => {
    const { error } = await supabase.rpc("admin_set_profile_blocked" as never, {
      _profile_id: p.id,
      _blocked: !p.is_blocked,
      _reason: p.is_blocked ? null : "Bloqueado pela administração",
    } as never);
    if (error) {
      toast.error("Não foi possível alterar o bloqueio.");
      return;
    }
    toast.success(p.is_blocked ? "Perfil desbloqueado." : "Perfil bloqueado.");
    setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_blocked: !p.is_blocked } : x)));
  };

  const remove = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.rpc("admin_delete_profile" as never, {
      _profile_id: confirmDelete.id,
    } as never);
    setConfirmDelete(null);
    if (error) {
      toast.error("Não foi possível excluir. Verifique registros vinculados.");
      return;
    }
    toast.success("Cadastro excluído.");
    await load();
  };

  return (
    <div className="space-y-4" data-testid="admin-people-panel">
      <Tabs value={userType} onValueChange={(v) => setUserType(v as "client" | "provider")}>
        <TabsList>
          <TabsTrigger value="client" data-testid="admin-people-clients">Clientes</TabsTrigger>
          <TabsTrigger value="provider" data-testid="admin-people-providers">Profissionais</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, telefone ou identificador"
            className="pl-9"
            data-testid="admin-people-search"
          />
        </div>
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Cidade"
          className="sm:w-48"
          data-testid="admin-people-city"
        />
        <div className="flex items-center gap-2 rounded-xl border border-border px-3">
          <Switch checked={includeSynthetic} onCheckedChange={setIncludeSynthetic} aria-label="Incluir perfis de demonstração" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Incluir demo</span>
        </div>
        <Button className="gap-1.5" onClick={() => openForm()} data-testid="admin-people-new">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum cadastro encontrado.</Card>
      ) : (
        rows.map((p) => (
          <Card key={p.id} className="p-4" data-testid="admin-people-row">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{p.display_name}</p>
                  {p.is_synthetic && <Badge variant="secondary" className="text-[10px]">Demo</Badge>}
                  {p.is_blocked && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
                  {p.provider_tier && <Badge className="text-[10px] capitalize">{p.provider_tier}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <span>{[p.city, p.state].filter(Boolean).join(", ") || "Sem localização"}</span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {Number(p.avg_rating ?? 0).toFixed(1)} · {p.total_reviews ?? 0} avaliações
                  </span>
                  <span>
                    Nota {userType === "provider" ? p.provider_score ?? 0 : p.client_score ?? 0}/100
                  </span>
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button
                  size="sm"
                  variant={p.is_blocked ? "outline" : "secondary"}
                  className="gap-1.5"
                  onClick={() => void toggleBlock(p)}
                  data-testid="admin-people-block"
                >
                  {p.is_blocked ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                  {p.is_blocked ? "Desbloquear" : "Bloquear"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openForm(p)} data-testid="admin-people-edit">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(p)} data-testid="admin-people-delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="admin-people-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">
              {form.id ? "Editar cadastro" : userType === "client" ? "Novo cliente" : "Novo profissional"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                className="min-h-[70px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Foto (endereço)</Label>
              <Input
                value={form.avatar_url}
                onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <Button className="w-full" disabled={saving} onClick={() => void save()} data-testid="admin-people-save">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se houver serviços vinculados, prefira bloquear o perfil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPeoplePanel;
