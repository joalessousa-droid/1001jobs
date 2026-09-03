import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Search, Bot, Tags, Users, RefreshCw, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProviderRow {
  id: string;
  display_name: string;
  bio: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_synthetic: boolean;
  synthetic_expires_at: string | null;
  verification_status: string;
  created_at: string;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

const emptyProvider = {
  display_name: "",
  bio: "",
  phone: "",
  city: "",
  state: "",
  avatar_url: "",
  is_synthetic: false,
};

const slugify = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const AdminManagement = () => {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const [providerForm, setProviderForm] = useState<typeof emptyProvider & { id?: string }>({ ...emptyProvider });
  const [providerOpen, setProviderOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<{ id?: string; name: string; slug: string; icon: string }>({
    name: "", slug: "", icon: "",
  });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "provider" | "category"; id: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: provs }, { data: cats }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, display_name, bio, phone, city, state, avatar_url, is_active, is_synthetic, synthetic_expires_at, verification_status, created_at",
        )
        .eq("user_type", "provider")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("service_categories").select("id, name, slug, icon").order("name"),
    ]);
    setProviders((provs ?? []) as ProviderRow[]);
    setCategories((cats ?? []) as CategoryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const humans = useMemo(() => providers.filter((p) => !p.is_synthetic), [providers]);
  const bots = useMemo(() => providers.filter((p) => p.is_synthetic), [providers]);

  const match = (list: ProviderRow[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.display_name.toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q) ||
        (p.state ?? "").toLowerCase().includes(q),
    );
  };

  /* ------------------------------------------------------------ providers */
  const openProvider = (p?: ProviderRow) => {
    setProviderForm(
      p
        ? {
            id: p.id,
            display_name: p.display_name,
            bio: p.bio ?? "",
            phone: p.phone ?? "",
            city: p.city ?? "",
            state: p.state ?? "",
            avatar_url: p.avatar_url ?? "",
            is_synthetic: p.is_synthetic,
          }
        : { ...emptyProvider },
    );
    setProviderOpen(true);
  };

  const saveProvider = async () => {
    if (!providerForm.display_name.trim()) {
      toast.error("Informe o nome do profissional.");
      return;
    }
    setSavingId("provider");
    try {
      if (providerForm.id) {
        const { error } = await supabase
          .from("profiles")
          .update({
            display_name: providerForm.display_name.trim(),
            bio: providerForm.bio || null,
            phone: providerForm.phone || null,
            city: providerForm.city || null,
            state: providerForm.state || null,
            avatar_url: providerForm.avatar_url || null,
          })
          .eq("id", providerForm.id);
        if (error) throw error;
        toast.success("Profissional atualizado.");
      } else {
        const { error } = await supabase.rpc("admin_create_provider" as never, {
          _display_name: providerForm.display_name.trim(),
          _bio: providerForm.bio || null,
          _phone: providerForm.phone || null,
          _city: providerForm.city || null,
          _state: providerForm.state || null,
          _avatar_url: providerForm.avatar_url || null,
          _is_synthetic: providerForm.is_synthetic,
        } as never);
        if (error) throw error;
        toast.success("Profissional cadastrado.");
      }
      setProviderOpen(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message ?? "Não foi possível salvar.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (p: ProviderRow) => {
    setSavingId(p.id);
    const { error } = await supabase.from("profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    setSavingId(null);
    if (error) {
      toast.error("Não foi possível alterar o status.");
      return;
    }
    setProviders((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
  };

  const renewBot = async (p: ProviderRow) => {
    setSavingId(p.id);
    const next = new Date();
    next.setDate(next.getDate() + 30);
    const { error } = await supabase
      .from("profiles")
      .update({ synthetic_expires_at: next.toISOString(), is_active: true })
      .eq("id", p.id);
    setSavingId(null);
    if (error) {
      toast.error("Não foi possível renovar o bot.");
      return;
    }
    toast.success("Bot renovado por mais 30 dias.");
    setProviders((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, synthetic_expires_at: next.toISOString(), is_active: true } : x)),
    );
  };

  /* ----------------------------------------------------------- categories */
  const openCategory = (c?: CategoryRow) => {
    setCategoryForm(c ? { id: c.id, name: c.name, slug: c.slug, icon: c.icon ?? "" } : { name: "", slug: "", icon: "" });
    setCategoryOpen(true);
  };

  const saveCategory = async () => {
    const name = categoryForm.name.trim();
    if (!name) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    const slug = (categoryForm.slug.trim() || slugify(name));
    setSavingId("category");
    try {
      if (categoryForm.id) {
        const { error } = await supabase
          .from("service_categories")
          .update({ name, slug, icon: categoryForm.icon || null })
          .eq("id", categoryForm.id);
        if (error) throw error;
        toast.success("Categoria atualizada.");
      } else {
        const { error } = await supabase
          .from("service_categories")
          .insert({ name, slug, icon: categoryForm.icon || null });
        if (error) throw error;
        toast.success("Categoria criada.");
      }
      setCategoryOpen(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message ?? "Não foi possível salvar a categoria.");
    } finally {
      setSavingId(null);
    }
  };

  /* --------------------------------------------------------------- delete */
  const runDelete = async () => {
    if (!confirm) return;
    const table = confirm.kind === "provider" ? "profiles" : "service_categories";
    const { error } = await supabase.from(table).delete().eq("id", confirm.id);
    setConfirm(null);
    if (error) {
      toast.error("Não foi possível excluir. Verifique se há registros vinculados.");
      return;
    }
    toast.success("Registro excluído.");
    await load();
  };

  const ProviderCard = ({ p }: { p: ProviderRow }) => (
    <Card key={p.id} className="p-4" data-testid="admin-provider-row">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{p.display_name}</p>
            {p.is_synthetic && <Badge variant="secondary" className="text-[10px]">Demo</Badge>}
            <Badge variant={p.is_active ? "default" : "outline"} className="text-[10px]">
              {p.is_active ? "Ativo" : "Inativo"}
            </Badge>
            {p.verification_status === "verified" && (
              <Badge className="text-[10px]">Verificado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {[p.city, p.state].filter(Boolean).join(", ") || "Sem localização"}
            {p.synthetic_expires_at &&
              ` · expira ${format(new Date(p.synthetic_expires_at), "dd MMM yyyy", { locale: ptBR })}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Switch
            checked={p.is_active}
            onCheckedChange={() => void toggleActive(p)}
            disabled={savingId === p.id}
            aria-label="Ativar profissional"
          />
          {p.is_synthetic && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void renewBot(p)}>
              <RefreshCw className="w-3.5 h-3.5" /> Renovar
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link to={`/provider/${p.id}`} title="Ver perfil público">
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => openProvider(p)} data-testid="admin-provider-edit">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirm({ kind: "provider", id: p.id, label: p.display_name })}
            data-testid="admin-provider-delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16" data-testid="admin-management">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Gestão da plataforma</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastre profissionais, organize categorias e gerencie os bots do radar.
          </p>
        </div>

        <Tabs defaultValue="providers">
          <TabsList>
            <TabsTrigger value="providers" className="gap-1.5">
              <Users className="w-4 h-4" /> Profissionais
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5">
              <Tags className="w-4 h-4" /> Categorias
            </TabsTrigger>
            <TabsTrigger value="bots" className="gap-1.5">
              <Bot className="w-4 h-4" /> Bots do radar
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="providers" className="space-y-3 mt-5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar profissional"
                      className="pl-9"
                    />
                  </div>
                  <Button className="gap-1.5" onClick={() => openProvider()} data-testid="admin-provider-new">
                    <Plus className="w-4 h-4" /> Novo
                  </Button>
                </div>
                {match(humans).map((p) => (
                  <ProviderCard key={p.id} p={p} />
                ))}
                {match(humans).length === 0 && (
                  <Card className="p-8 text-center text-muted-foreground">Nenhum profissional encontrado.</Card>
                )}
              </TabsContent>

              <TabsContent value="categories" className="space-y-3 mt-5">
                <div className="flex justify-end">
                  <Button className="gap-1.5" onClick={() => openCategory()} data-testid="admin-category-new">
                    <Plus className="w-4 h-4" /> Nova categoria
                  </Button>
                </div>
                {categories.map((c) => (
                  <Card key={c.id} className="p-4 flex items-center justify-between gap-3" data-testid="admin-category-row">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground">/{c.slug}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openCategory(c)} data-testid="admin-category-edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirm({ kind: "category", id: c.id, label: c.name })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
                {categories.length === 0 && (
                  <Card className="p-8 text-center text-muted-foreground">Nenhuma categoria cadastrada.</Card>
                )}
              </TabsContent>

              <TabsContent value="bots" className="space-y-3 mt-5">
                <Card className="p-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {bots.length} perfis de demonstração usados no radar.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/synthetic-bot">Auditoria do bot</Link>
                  </Button>
                </Card>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar bot"
                    className="pl-9"
                  />
                </div>
                {match(bots).slice(0, 100).map((p) => (
                  <ProviderCard key={p.id} p={p} />
                ))}
                {match(bots).length === 0 && (
                  <Card className="p-8 text-center text-muted-foreground">Nenhum bot ativo.</Card>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      {/* Provider dialog */}
      <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
        <DialogContent className="sm:max-w-md" data-testid="admin-provider-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">
              {providerForm.id ? "Editar profissional" : "Novo profissional"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={providerForm.display_name}
                onChange={(e) => setProviderForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={providerForm.bio}
                onChange={(e) => setProviderForm((f) => ({ ...f, bio: e.target.value }))}
                className="min-h-[70px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input
                  value={providerForm.city}
                  onChange={(e) => setProviderForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  value={providerForm.state}
                  onChange={(e) => setProviderForm((f) => ({ ...f, state: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={providerForm.phone}
                onChange={(e) => setProviderForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Foto (URL)</Label>
              <Input
                value={providerForm.avatar_url}
                onChange={(e) => setProviderForm((f) => ({ ...f, avatar_url: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            {!providerForm.id && (
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Perfil de demonstração</p>
                  <p className="text-xs text-muted-foreground">Aparece como bot do radar e expira em 30 dias.</p>
                </div>
                <Switch
                  checked={providerForm.is_synthetic}
                  onCheckedChange={(v) => setProviderForm((f) => ({ ...f, is_synthetic: v }))}
                />
              </div>
            )}
            <Button
              className="w-full"
              disabled={savingId === "provider"}
              onClick={() => void saveProvider()}
              data-testid="admin-provider-save"
            >
              {savingId === "provider" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="admin-category-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">
              {categoryForm.id ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder={slugify(categoryForm.name) || "encanador"}
              />
            </div>
            <div>
              <Label>Ícone (emoji)</Label>
              <Input
                value={categoryForm.icon}
                onChange={(e) => setCategoryForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="🔧"
              />
            </div>
            <Button
              className="w-full"
              disabled={savingId === "category"}
              onClick={() => void saveCategory()}
              data-testid="admin-category-save"
            >
              {savingId === "category" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{confirm?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Registros vinculados podem impedir a exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminManagement;
