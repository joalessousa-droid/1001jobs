import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ShieldCheck, LifeBuoy, AlertTriangle, Search, ExternalLink,
} from "lucide-react";

interface ServiceRow {
  id: string;
  title: string;
  status: string;
  currency: string | null;
  agreed_price: number | null;
  client_id: string | null;
  provider_id: string | null;
  created_at: string;
}

interface CaseRow {
  id: string;
  service_id: string;
  status: string;
  reason: string;
  description: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  refund_amount: number | null;
  service: { title: string; currency: string | null; agreed_price: number | null } | null;
}

const OPEN_STATUSES = ["open", "evidence_requested", "under_review"];

const REASONS = [
  "Serviço não realizado",
  "Serviço incompleto",
  "Qualidade abaixo do combinado",
  "Cobrança divergente",
  "Dano ao patrimônio",
  "Comportamento inadequado",
  "Outro",
];

const DECISIONS: { value: string; label: string }[] = [
  { value: "resolved_client", label: "A favor do cliente (reembolso)" },
  { value: "resolved_provider", label: "A favor do prestador" },
  { value: "resolved_split", label: "Acordo dividido" },
  { value: "closed_no_action", label: "Encerrado sem ação" },
];

const statusLabel = (s: string) =>
  ({
    open: "Aberto",
    evidence_requested: "Aguardando evidências",
    under_review: "Em análise",
    resolved_client: "Resolvido — cliente",
    resolved_provider: "Resolvido — prestador",
    resolved_split: "Resolvido — acordo",
    closed_no_action: "Encerrado",
  } as Record<string, string>)[s] ?? s;

const AdminSupport = () => {
  const { isModerator, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  // ---- novo caso
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ServiceRow[]>([]);
  const [selected, setSelected] = useState<ServiceRow | null>(null);
  const [onBehalf, setOnBehalf] = useState("client");
  const [reason, setReason] = useState(REASONS[0]);
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // ---- casos
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [resolving, setResolving] = useState<CaseRow | null>(null);
  const [decision, setDecision] = useState("resolved_split");
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCases = async () => {
    setLoadingCases(true);
    const { data } = await supabase
      .from("service_disputes")
      .select(
        "id, service_id, status, reason, description, created_at, resolved_at, resolution, refund_amount, service:services(title, currency, agreed_price)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    setCases(((data as unknown as CaseRow[]) ?? []));
    setLoadingCases(false);
  };

  useEffect(() => {
    if (isModerator) void loadCases();
  }, [isModerator]);

  const searchServices = async () => {
    setSearching(true);
    try {
      const term = query.trim();
      let q = supabase
        .from("services")
        .select("id, title, status, currency, agreed_price, client_id, provider_id, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (term) {
        const isUuid = /^[0-9a-f-]{36}$/i.test(term);
        q = isUuid ? q.eq("id", term) : q.ilike("title", `%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setResults((data as ServiceRow[]) ?? []);
    } catch (e) {
      toast({
        title: "Erro na busca",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const createCase = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("admin_open_service_dispute", {
        _service_id: selected.id,
        _reason: reason,
        _description: description || null,
        _on_behalf_of: onBehalf,
      });
      if (error) throw error;
      await supabase.functions.invoke("notify-dispute-event", {
        body: { dispute_id: data, event: "opened", message: reason },
      }).catch(() => undefined);
      toast({ title: "Caso registrado", description: "O prestador e o cliente foram notificados." });
      setSelected(null);
      setDescription("");
      void loadCases();
    } catch (e) {
      toast({
        title: "Não foi possível abrir o caso",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const submitResolution = async () => {
    if (!resolving) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("resolve_service_dispute", {
        _dispute_id: resolving.id,
        _decision: decision,
        _resolution: resolution,
        _refund_amount: refund ? Number(refund) : undefined,
        _moderator_notes: notes || undefined,
      });
      if (error) throw error;
      await supabase.functions.invoke("notify-dispute-event", {
        body: { dispute_id: resolving.id, event: "resolved", message: resolution },
      }).catch(() => undefined);
      toast({ title: "Caso resolvido com o prestador" });
      setResolving(null);
      setResolution(""); setRefund(""); setNotes("");
      void loadCases();
    } catch (e) {
      toast({
        title: "Erro ao resolver",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center pt-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isModerator) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-md pt-32 text-center mx-auto px-4">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <h1 className="text-xl font-semibold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Esta área é exclusiva para a equipe de suporte e moderação.
          </p>
          <Button variant="outline" onClick={() => navigate("/admin/login")}>Entrar como admin</Button>
        </div>
      </div>
    );
  }

  const openCases = cases.filter((c) => OPEN_STATUSES.includes(c.status));
  const closedCases = cases.filter((c) => !OPEN_STATUSES.includes(c.status));

  const renderCase = (c: CaseRow) => (
    <Card key={c.id} className="p-4" data-testid="support-case">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <h3 className="font-semibold truncate">{c.service?.title ?? "Serviço"}</h3>
            <Badge variant="outline" className="text-[10px]">{statusLabel(c.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">Motivo: {c.reason}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Aberto em {new Date(c.created_at).toLocaleString("pt-BR")}
            {c.service?.agreed_price
              ? ` • ${c.service.currency ?? "BRL"} ${Number(c.service.agreed_price).toFixed(2)}`
              : ""}
          </p>
          {c.resolution && (
            <p className="text-xs text-emerald-500 mt-1">Decisão: {c.resolution}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/disputa/${c.id}`}>
              Ver <ExternalLink className="w-3 h-3 ml-1" />
            </Link>
          </Button>
          {OPEN_STATUSES.includes(c.status) && (
            <Button size="sm" data-testid="support-resolve" onClick={() => setResolving(c)}>
              Resolver
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-5xl px-4 sm:px-6 pt-24 pb-16 mx-auto" data-testid="admin-support">
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-primary" /> Suporte 1001 Garantia
          </h1>
          <p className="text-sm text-muted-foreground">
            Registre casos de disputa em nome do cliente ou do prestador e conduza a resolução.
          </p>
        </div>

        <Card className="p-4 mb-6 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Todo caso aberto aqui aciona a <strong className="text-foreground">1001 Garantia</strong>:
              o pagamento fica retido, as evidências antes/depois são anexadas ao caso e a decisão
              define reembolso ou liberação ao prestador.
            </p>
          </div>
        </Card>

        <Tabs defaultValue="new">
          <TabsList className="mb-4">
            <TabsTrigger value="new" data-testid="tab-new-case">Novo caso</TabsTrigger>
            <TabsTrigger value="open" data-testid="tab-open-cases">
              Em aberto {openCases.length > 0 && `(${openCases.length})`}
            </TabsTrigger>
            <TabsTrigger value="closed" data-testid="tab-closed-cases">Resolvidos</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            <Card className="p-4 space-y-3">
              <Label htmlFor="svc-search">Buscar serviço (título ou ID)</Label>
              <div className="flex gap-2">
                <Input
                  id="svc-search"
                  data-testid="support-search-input"
                  value={query}
                  placeholder="Ex.: Instalação elétrica"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void searchServices()}
                />
                <Button onClick={() => void searchServices()} disabled={searching} data-testid="support-search">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {results.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s)}
                    data-testid="support-service-option"
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selected?.id === s.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{s.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{s.status}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      {s.agreed_price ? ` • ${s.currency ?? "BRL"} ${Number(s.agreed_price).toFixed(2)}` : ""}
                    </span>
                  </button>
                ))}
                {!searching && results.length === 0 && (
                  <p className="text-sm text-muted-foreground">Busque um serviço para iniciar o caso.</p>
                )}
              </div>
            </Card>

            {selected && (
              <Card className="p-4 space-y-4" data-testid="support-case-form">
                <div>
                  <p className="text-xs text-muted-foreground">Serviço selecionado</p>
                  <p className="font-medium">{selected.title}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Registrar em nome de</Label>
                    <Select value={onBehalf} onValueChange={setOnBehalf}>
                      <SelectTrigger data-testid="support-on-behalf"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="provider">Prestador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger data-testid="support-reason"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REASONS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="case-desc">Descrição do caso</Label>
                  <Textarea
                    id="case-desc"
                    data-testid="support-description"
                    rows={4}
                    value={description}
                    placeholder="Relato recebido pelo suporte, evidências mencionadas, contatos realizados..."
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
                  <Button onClick={() => void createCase()} disabled={creating} data-testid="support-create">
                    {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Registrar caso
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="open" className="space-y-3">
            {loadingCases ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : openCases.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">Nenhum caso em aberto.</Card>
            ) : (
              openCases.map(renderCase)
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-3">
            {closedCases.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">Nenhum caso resolvido ainda.</Card>
            ) : (
              closedCases.map(renderCase)
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent data-testid="support-resolve-dialog">
          <DialogHeader>
            <DialogTitle>Resolver caso com o prestador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Decisão</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger data-testid="support-decision"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DECISIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-text">Resolução (visível às partes)</Label>
              <Textarea
                id="res-text"
                rows={3}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                data-testid="support-resolution"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="res-refund">Reembolso (R$)</Label>
                <Input
                  id="res-refund"
                  type="number"
                  min="0"
                  step="0.01"
                  value={refund}
                  onChange={(e) => setRefund(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-notes">Notas internas</Label>
                <Input id="res-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>Cancelar</Button>
            <Button
              onClick={() => void submitResolution()}
              disabled={saving || !resolution.trim()}
              data-testid="support-resolve-confirm"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar resolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupport;
