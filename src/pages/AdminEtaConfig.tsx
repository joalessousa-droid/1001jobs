import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Save, Trash2, History, Mail, Webhook, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string; alert_type: string; name: string; subject: string; html_body: string;
  is_default: boolean; is_active: boolean; updated_at: string;
}
interface TemplateVersion {
  id: string; template_id: string; version: number; subject: string; html_body: string;
  name: string; alert_type: string; created_at: string;
}
interface Hook {
  id: string; name: string; url: string; secret: string | null; headers: any;
  is_active: boolean; alert_types: string[]; min_severity: string; max_retries: number;
}

const ALERT_TYPES = ["persistent_degradation", "slow_responses", "intense_traffic"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const emptyTpl = (): Partial<Template> => ({ alert_type: "persistent_degradation", name: "", subject: "", html_body: "", is_default: false, is_active: true });
const emptyHook = (): Partial<Hook> => ({ name: "", url: "", secret: "", is_active: true, alert_types: [], min_severity: "high", max_retries: 3 });

const AdminEtaConfig = () => {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [editingTpl, setEditingTpl] = useState<Partial<Template> | null>(null);
  const [editingHook, setEditingHook] = useState<Partial<Hook> | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [viewVersionsFor, setViewVersionsFor] = useState<Template | null>(null);

  useEffect(() => { if (!roleLoading && !isAdmin) navigate("/dashboard"); }, [isAdmin, roleLoading, navigate]);

  const load = async () => {
    const [t, h] = await Promise.all([
      supabase.from("eta_alert_email_templates" as any).select("*").order("alert_type"),
      supabase.from("eta_alert_webhooks" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setTemplates((t.data as any) ?? []);
    setHooks((h.data as any) ?? []);
  };
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const saveTemplate = async () => {
    if (!editingTpl) return;
    const payload = { ...editingTpl };
    const { id, ...rest } = payload as any;
    const op = id
      ? supabase.from("eta_alert_email_templates" as any).update(rest).eq("id", id)
      : supabase.from("eta_alert_email_templates" as any).insert(rest);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Template salvo (nova versão registrada)");
    setEditingTpl(null);
    await load();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Excluir template? O histórico de versões será removido.")) return;
    const { error } = await supabase.from("eta_alert_email_templates" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Template excluído");
    await load();
  };

  const loadVersions = async (tpl: Template) => {
    setViewVersionsFor(tpl);
    const { data } = await supabase.from("eta_alert_email_template_versions" as any)
      .select("*").eq("template_id", tpl.id).order("version", { ascending: false });
    setVersions((data as any) ?? []);
  };

  const revertTo = async (v: TemplateVersion) => {
    const { error } = await supabase.from("eta_alert_email_templates" as any)
      .update({ subject: v.subject, html_body: v.html_body, name: v.name, alert_type: v.alert_type })
      .eq("id", v.template_id);
    if (error) return toast.error(error.message);
    toast.success(`Revertido para v${v.version} (nova versão criada)`);
    setViewVersionsFor(null);
    await load();
  };

  const saveHook = async () => {
    if (!editingHook) return;
    const payload = { ...editingHook };
    const { id, ...rest } = payload as any;
    if (!rest.url?.match(/^https?:\/\//)) return toast.error("URL inválida (use http(s)://)");
    const op = id
      ? supabase.from("eta_alert_webhooks" as any).update(rest).eq("id", id)
      : supabase.from("eta_alert_webhooks" as any).insert(rest);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Webhook salvo");
    setEditingHook(null);
    await load();
  };

  const deleteHook = async (id: string) => {
    if (!confirm("Excluir webhook?")) return;
    const { error } = await supabase.from("eta_alert_webhooks" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Webhook excluído");
    await load();
  };

  if (roleLoading || !isAdmin) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Configuração de alertas ETA</h1>
        <p className="text-sm text-muted-foreground">Templates de e-mail e destinos de webhook por tipo de alerta — sem necessidade de redeploy.</p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates"><Mail className="w-4 h-4 mr-1" /> Templates de e-mail</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-1" /> Webhooks</TabsTrigger>
        </TabsList>

        {/* ---------------- TEMPLATES ---------------- */}
        <TabsContent value="templates" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditingTpl(emptyTpl())}><Plus className="w-4 h-4 mr-1" /> Novo template</Button>
          </div>
          {templates.map((t) => (
            <Card key={t.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t.name}</span>
                  <Badge variant="outline">{t.alert_type}</Badge>
                  {t.is_default && <Badge>default</Badge>}
                  {!t.is_active && <Badge variant="destructive">inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">Assunto: {t.subject}</p>
                <p className="text-[11px] text-muted-foreground">Atualizado: {new Date(t.updated_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => loadVersions(t)}><History className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => setEditingTpl(t)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            </Card>
          ))}
          {templates.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum template cadastrado.</Card>}
        </TabsContent>

        {/* ---------------- WEBHOOKS ---------------- */}
        <TabsContent value="webhooks" className="space-y-3">
          <Card className="p-3 text-xs text-muted-foreground">
            Webhooks recebem POST com payload do alerta. Quando há segredo configurado, a requisição inclui
            <code className="mx-1 px-1 bg-muted rounded">X-Webhook-Signature: sha256=&lt;hmac&gt;</code>
            calculado sobre o corpo bruto — valide no destino antes de processar.
          </Card>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditingHook(emptyHook())}><Plus className="w-4 h-4 mr-1" /> Novo webhook</Button>
          </div>
          {hooks.map((h) => (
            <Card key={h.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{h.name}</span>
                  {!h.is_active && <Badge variant="destructive">inativo</Badge>}
                  <Badge variant="outline">≥ {h.min_severity}</Badge>
                  {h.secret && <Badge variant="secondary">HMAC</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{h.url}</p>
                <p className="text-[11px] text-muted-foreground">
                  Tipos: {h.alert_types?.length ? h.alert_types.join(", ") : "todos"} · retries: {h.max_retries}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditingHook(h)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteHook(h.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            </Card>
          ))}
          {hooks.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum webhook cadastrado.</Card>}
        </TabsContent>
      </Tabs>

      {/* Template editor */}
      <Dialog open={!!editingTpl} onOpenChange={(o) => !o && setEditingTpl(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTpl?.id ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
          {editingTpl && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo de alerta</Label>
                  <Select value={editingTpl.alert_type} onValueChange={(v) => setEditingTpl({ ...editingTpl, alert_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ALERT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={editingTpl.name ?? ""} onChange={(e) => setEditingTpl({ ...editingTpl, name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Assunto</Label>
                <Input value={editingTpl.subject ?? ""} onChange={(e) => setEditingTpl({ ...editingTpl, subject: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Corpo HTML</Label>
                <Textarea rows={12} className="font-mono text-xs" value={editingTpl.html_body ?? ""} onChange={(e) => setEditingTpl({ ...editingTpl, html_body: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Placeholders: {"{{alert_type}}, {{period_from}}, {{period_to}}, {{window_min}}, {{samples}}, {{failures}}, {{failure_pct}}, {{avg_ms}}, {{p95_ms}}, {{avg_traffic}}, {{top_cities_html}}, {{top_providers_html}}, {{tuning_json}}, {{generated_at}}, {{dashboard_url}}"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!editingTpl.is_active} onCheckedChange={(v) => setEditingTpl({ ...editingTpl, is_active: v })} /> Ativo</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!editingTpl.is_default} onCheckedChange={(v) => setEditingTpl({ ...editingTpl, is_default: v })} /> Default p/ esse tipo</label>
              </div>
              <Button onClick={saveTemplate}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Webhook editor */}
      <Dialog open={!!editingHook} onOpenChange={(o) => !o && setEditingHook(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingHook?.id ? "Editar webhook" : "Novo webhook"}</DialogTitle></DialogHeader>
          {editingHook && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={editingHook.name ?? ""} onChange={(e) => setEditingHook({ ...editingHook, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">URL</Label>
                <Input value={editingHook.url ?? ""} onChange={(e) => setEditingHook({ ...editingHook, url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Segredo HMAC (opcional)</Label>
                <Input type="password" value={editingHook.secret ?? ""} onChange={(e) => setEditingHook({ ...editingHook, secret: e.target.value })} placeholder="usado para assinar X-Webhook-Signature" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Severidade mínima</Label>
                  <Select value={editingHook.min_severity} onValueChange={(v) => setEditingHook({ ...editingHook, min_severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Máx retries</Label>
                  <Input type="number" min={0} max={10} value={editingHook.max_retries ?? 3} onChange={(e) => setEditingHook({ ...editingHook, max_retries: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Tipos de alerta (vazio = todos)</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {ALERT_TYPES.map((t) => {
                    const on = editingHook.alert_types?.includes(t);
                    return (
                      <Badge key={t} variant={on ? "default" : "outline"} className="cursor-pointer"
                        onClick={() => setEditingHook({
                          ...editingHook,
                          alert_types: on
                            ? (editingHook.alert_types ?? []).filter((x) => x !== t)
                            : [...(editingHook.alert_types ?? []), t],
                        })}>{t}</Badge>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!editingHook.is_active} onCheckedChange={(v) => setEditingHook({ ...editingHook, is_active: v })} /> Ativo</label>
              <Button onClick={saveHook}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Versions browser */}
      <Dialog open={!!viewVersionsFor} onOpenChange={(o) => !o && setViewVersionsFor(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico — {viewVersionsFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {versions.map((v) => (
              <Card key={v.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge>v{v.version}</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => revertTo(v)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reverter
                  </Button>
                </div>
                <p className="text-xs mt-2"><b>Assunto:</b> {v.subject}</p>
                <pre className="bg-muted/40 p-2 rounded text-[11px] overflow-auto max-h-40 mt-1">{v.html_body}</pre>
              </Card>
            ))}
            {versions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem versões.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEtaConfig;
