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
import { Plus, Save, Trash2, History, Mail, Webhook, RotateCcw, KeyRound, Send, ShieldCheck, Clock } from "lucide-react";
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
  version: number; secret_next: string | null;
  secret_next_activates_at: string | null; secret_expires_at: string | null;
}
interface HookVersion {
  id: string; webhook_id: string; version: number; name: string; url: string;
  alert_types: string[] | null; min_severity: string | null; max_retries: number | null;
  created_at: string;
}
interface RollbackLog {
  id: string; entity_type: string; entity_id: string;
  from_version: number | null; to_version: number;
  reverted_by: string | null; reverted_at: string; reason: string | null;
}
interface TestResult {
  ok: boolean; http_status: number | null; duration_ms: number;
  payload_size: number; signature: string | null; signature_next: string | null;
  signature_algo: string | null; error: string | null; response_preview: string;
  webhook_version: number;
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
  const [hookVersions, setHookVersions] = useState<HookVersion[]>([]);
  const [viewHookVersionsFor, setViewHookVersionsFor] = useState<Hook | null>(null);
  const [rollbackLog, setRollbackLog] = useState<RollbackLog[]>([]);
  const [rotateFor, setRotateFor] = useState<Hook | null>(null);
  const [rotateSecret, setRotateSecret] = useState("");
  const [rotateActivatesAt, setRotateActivatesAt] = useState("");
  const [rotateExpiresAt, setRotateExpiresAt] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");

  useEffect(() => { if (!roleLoading && !isAdmin) navigate("/dashboard"); }, [isAdmin, roleLoading, navigate]);

  const load = async () => {
    const [t, h, rl] = await Promise.all([
      supabase.from("eta_alert_email_templates" as any).select("*").order("alert_type"),
      supabase.from("eta_alert_webhooks" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("eta_alert_rollback_log" as any).select("*").order("reverted_at", { ascending: false }).limit(50),
    ]);
    setTemplates((t.data as any) ?? []);
    setHooks((h.data as any) ?? []);
    setRollbackLog((rl.data as any) ?? []);
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

  const revertTemplate = async (v: TemplateVersion) => {
    const reason = prompt("Motivo do rollback (opcional):") ?? "";
    const { data, error } = await supabase.rpc("rollback_eta_template" as any, {
      _template_id: v.template_id, _to_version: v.version, _reason: reason || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`Revertido para v${v.version}`);
    setViewVersionsFor(null);
    await load();
  };

  const loadHookVersions = async (h: Hook) => {
    setViewHookVersionsFor(h);
    const { data } = await supabase.from("eta_alert_webhook_versions" as any)
      .select("*").eq("webhook_id", h.id).order("version", { ascending: false });
    setHookVersions((data as any) ?? []);
  };

  const revertHook = async (v: HookVersion) => {
    const reason = prompt("Motivo do rollback (opcional):") ?? "";
    const { data, error } = await supabase.rpc("rollback_eta_webhook" as any, {
      _webhook_id: v.webhook_id, _to_version: v.version, _reason: reason || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`Webhook revertido para v${v.version}`);
    setViewHookVersionsFor(null);
    await load();
  };

  const saveHook = async () => {
    if (!editingHook) return;
    const payload = { ...editingHook };
    const { id, version, secret_next, secret_next_activates_at, secret_expires_at, ...rest } = payload as any;
    if (!rest.url?.match(/^https?:\/\//)) return toast.error("URL inválida (use http(s)://)");
    const op = id
      ? supabase.from("eta_alert_webhooks" as any).update(rest).eq("id", id)
      : supabase.from("eta_alert_webhooks" as any).insert(rest);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Webhook salvo (nova versão registrada)");
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

  const submitRotation = async () => {
    if (!rotateFor) return;
    if (!rotateSecret || rotateSecret.length < 8) return toast.error("Segredo deve ter ao menos 8 caracteres");
    const { error } = await supabase.rpc("rotate_eta_webhook_secret" as any, {
      _webhook_id: rotateFor.id,
      _new_secret: rotateSecret,
      _activates_at: rotateActivatesAt ? new Date(rotateActivatesAt).toISOString() : null,
      _expires_at: rotateExpiresAt ? new Date(rotateExpiresAt).toISOString() : null,
    });
    if (error) return toast.error(error.message);
    toast.success(rotateActivatesAt ? "Próximo segredo agendado" : "Segredo rotacionado");
    setRotateFor(null); setRotateSecret(""); setRotateActivatesAt(""); setRotateExpiresAt("");
    await load();
  };

  const promoteNext = async (h: Hook) => {
    if (!confirm("Promover o próximo segredo para ativo agora?")) return;
    const { error } = await supabase.rpc("promote_eta_webhook_next_secret" as any, { _webhook_id: h.id });
    if (error) return toast.error(error.message);
    toast.success("Promovido");
    await load();
  };

  const testWebhook = async (h: Hook) => {
    setTesting(h.id);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("eta-webhook-test", { body: { webhook_id: h.id } });
      if (error) return toast.error(error.message);
      setTestResult(data as TestResult);
    } finally { setTesting(null); }
  };

  if (roleLoading || !isAdmin) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Configuração de alertas ETA</h1>
        <p className="text-sm text-muted-foreground">Templates de e-mail, destinos de webhook, rotação de segredos e rollback — sem necessidade de redeploy.</p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates"><Mail className="w-4 h-4 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-1" /> Webhooks</TabsTrigger>
          <TabsTrigger value="rollback"><History className="w-4 h-4 mr-1" /> Rollback log</TabsTrigger>
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
            calculado sobre o corpo bruto. Durante rotação, o cabeçalho extra
            <code className="mx-1 px-1 bg-muted rounded">X-Webhook-Signature-Next</code>
            permite validar com o próximo segredo sem janela de quebra.
          </Card>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditingHook(emptyHook())}><Plus className="w-4 h-4 mr-1" /> Novo webhook</Button>
          </div>
          {hooks.map((h) => (
            <Card key={h.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{h.name}</span>
                    <Badge variant="outline">v{h.version}</Badge>
                    {!h.is_active && <Badge variant="destructive">inativo</Badge>}
                    <Badge variant="outline">≥ {h.min_severity}</Badge>
                    {h.secret && <Badge variant="secondary"><ShieldCheck className="w-3 h-3 mr-1" />HMAC</Badge>}
                    {h.secret_next && <Badge className="bg-amber-500 text-white"><Clock className="w-3 h-3 mr-1" />rotação pendente</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{h.url}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tipos: {h.alert_types?.length ? h.alert_types.join(", ") : "todos"} · retries: {h.max_retries}
                    {h.secret_expires_at && <> · expira: {new Date(h.secret_expires_at).toLocaleString()}</>}
                    {h.secret_next_activates_at && <> · próximo ativa em: {new Date(h.secret_next_activates_at).toLocaleString()}</>}
                  </p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  <Button size="sm" variant="outline" onClick={() => testWebhook(h)} disabled={testing === h.id}>
                    <Send className="w-3.5 h-3.5 mr-1" />{testing === h.id ? "Testando…" : "Testar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRotateFor(h)}>
                    <KeyRound className="w-3.5 h-3.5 mr-1" /> Rotacionar
                  </Button>
                  {h.secret_next && (
                    <Button size="sm" variant="outline" onClick={() => promoteNext(h)}>Promover próximo</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => loadHookVersions(h)}><History className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingHook(h)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteHook(h.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              </div>
            </Card>
          ))}
          {hooks.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum webhook cadastrado.</Card>}
        </TabsContent>

        {/* ---------------- ROLLBACK LOG ---------------- */}
        <TabsContent value="rollback" className="space-y-3">
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Quando</th>
                  <th className="text-left p-2">Entidade</th>
                  <th className="text-left p-2">ID</th>
                  <th className="text-center p-2">De → Para</th>
                  <th className="text-left p-2">Por</th>
                  <th className="text-left p-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {rollbackLog.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2 tabular-nums">{new Date(r.reverted_at).toLocaleString()}</td>
                    <td className="p-2"><Badge variant="outline">{r.entity_type}</Badge></td>
                    <td className="p-2 font-mono text-[10px] truncate max-w-[160px]">{r.entity_id}</td>
                    <td className="p-2 text-center">v{r.from_version ?? "?"} → v{r.to_version}</td>
                    <td className="p-2 font-mono text-[10px] truncate max-w-[140px]">{r.reverted_by ?? "—"}</td>
                    <td className="p-2 max-w-[300px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</td>
                  </tr>
                ))}
                {rollbackLog.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Nenhum rollback registrado.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
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
                <p className="text-[11px] text-muted-foreground mt-1">Para rotação programada, use o botão “Rotacionar” após salvar.</p>
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

      {/* Template versions */}
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
                  <Button size="sm" variant="outline" onClick={() => revertTemplate(v)}>
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

      {/* Hook versions */}
      <Dialog open={!!viewHookVersionsFor} onOpenChange={(o) => !o && setViewHookVersionsFor(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico do webhook — {viewHookVersionsFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {hookVersions.map((v) => (
              <Card key={v.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge>v{v.version}</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => revertHook(v)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reverter
                  </Button>
                </div>
                <p className="text-xs mt-2"><b>Nome:</b> {v.name}</p>
                <p className="text-xs"><b>URL:</b> <span className="font-mono break-all">{v.url}</span></p>
                <p className="text-xs"><b>Tipos:</b> {v.alert_types?.join(", ") || "todos"} · sev≥{v.min_severity} · retries {v.max_retries}</p>
              </Card>
            ))}
            {hookVersions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem versões.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rotate secret */}
      <Dialog open={!!rotateFor} onOpenChange={(o) => !o && setRotateFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rotacionar segredo — {rotateFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label className="text-xs">Novo segredo</Label>
              <Input type="password" value={rotateSecret} onChange={(e) => setRotateSecret(e.target.value)} placeholder="mín 8 caracteres" />
            </div>
            <div>
              <Label className="text-xs">Ativa em (opcional — deixe em branco para imediato)</Label>
              <Input type="datetime-local" value={rotateActivatesAt} onChange={(e) => setRotateActivatesAt(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">Durante a janela, requisições são dual-signed com o segredo atual + novo (header <code>X-Webhook-Signature-Next</code>).</p>
            </div>
            <div>
              <Label className="text-xs">Expira em (opcional)</Label>
              <Input type="datetime-local" value={rotateExpiresAt} onChange={(e) => setRotateExpiresAt(e.target.value)} />
            </div>
            <Button onClick={submitRotation}><KeyRound className="w-4 h-4 mr-1" /> Confirmar rotação</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test result */}
      <Dialog open={!!testResult} onOpenChange={(o) => !o && setTestResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Resultado do teste de webhook</DialogTitle></DialogHeader>
          {testResult && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={testResult.ok ? "default" : "destructive"}>
                  {testResult.ok ? "OK" : "FALHA"}
                </Badge>
                <Badge variant="outline">HTTP {testResult.http_status ?? "—"}</Badge>
                <Badge variant="outline">{testResult.duration_ms}ms</Badge>
                <Badge variant="outline">{testResult.payload_size}B</Badge>
                <Badge variant="outline">v{testResult.webhook_version}</Badge>
              </div>
              {testResult.signature && (
                <div>
                  <Label className="text-xs">Assinatura enviada ({testResult.signature_algo})</Label>
                  <code className="block bg-muted p-2 rounded text-[10px] break-all">sha256={testResult.signature}</code>
                </div>
              )}
              {testResult.signature_next && (
                <div>
                  <Label className="text-xs">Assinatura próxima (dual-sign)</Label>
                  <code className="block bg-muted p-2 rounded text-[10px] break-all">sha256={testResult.signature_next}</code>
                </div>
              )}
              {testResult.error && (
                <div className="text-destructive text-xs"><b>Erro:</b> {testResult.error}</div>
              )}
              <div>
                <Label className="text-xs">Resposta (preview)</Label>
                <pre className="bg-muted/40 p-2 rounded text-[11px] overflow-auto max-h-40">{testResult.response_preview || "—"}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEtaConfig;
