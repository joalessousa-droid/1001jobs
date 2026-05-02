import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, ArrowLeft, Clock, Paperclip, Send, ShieldCheck,
  CheckCircle2, XCircle, Loader2, FileText, User, Wrench
} from "lucide-react";
import ServiceStatusBadge from "@/components/services/ServiceStatusBadge";
import { transitionStatus } from "@/hooks/useServices";

interface Service {
  id: string;
  client_id: string;
  provider_id: string;
  title: string;
  description: string | null;
  agreed_price: number | null;
  currency: string;
  status: any;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  disputed_at: string | null;
}

interface Dispute {
  id: string;
  service_id: string;
  opened_by: string;
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  refund_amount: number | null;
  resolved_at: string | null;
  created_at: string;
}

interface Evidence {
  id: string;
  dispute_id: string;
  submitted_by: string;
  message: string | null;
  file_urls: string[];
  created_at: string;
}

interface HistoryItem {
  id: string;
  service_id: string;
  changed_by: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  open: { label: "Aberta", className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  evidence_requested: { label: "Aguardando evidências", className: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  under_review: { label: "Em análise", className: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  resolved_client: { label: "Resolvida — favor do cliente", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  resolved_provider: { label: "Resolvida — favor do profissional", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  resolved_split: { label: "Resolvida — acordo", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  closed_no_action: { label: "Encerrada sem ação", className: "bg-muted text-muted-foreground" },
};

const ServiceDispute = () => {
  const { disputeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).single()
      .then(({ data }) => data && setProfileId(data.id));
  }, [user]);

  const load = async () => {
    if (!disputeId) return;
    setLoading(true);
    const { data: d } = await supabase.from("service_disputes").select("*").eq("id", disputeId).maybeSingle();
    if (!d) { setLoading(false); return; }
    setDispute(d as any);

    const [{ data: s }, { data: ev }, { data: h }] = await Promise.all([
      supabase.from("services").select("*").eq("id", d.service_id).maybeSingle(),
      supabase.from("service_dispute_evidence").select("*").eq("dispute_id", disputeId).order("created_at"),
      supabase.from("service_status_history").select("*").eq("service_id", d.service_id).order("created_at"),
    ]);
    if (s) setService(s as any);
    setEvidence((ev as any[]) ?? []);
    setHistory((h as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [disputeId]);

  // Realtime evidence
  useEffect(() => {
    if (!disputeId) return;
    const ch = supabase
      .channel(`dispute-${disputeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_dispute_evidence", filter: `dispute_id=eq.${disputeId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_disputes", filter: `id=eq.${disputeId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [disputeId]);

  const MAX_FILES = 5;
  const MAX_SIZE_MB = 10;
  const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const list = Array.from(e.target.files);
    if (list.length > MAX_FILES) {
      toast({ title: `Máximo de ${MAX_FILES} arquivos por evidência`, variant: "destructive" });
      e.target.value = "";
      return;
    }
    const invalid = list.find((f) => !ALLOWED.includes(f.type));
    if (invalid) {
      toast({ title: "Tipo inválido", description: `Apenas PDF e imagens (JPG, PNG, WEBP, GIF). "${invalid.name}" foi rejeitado.`, variant: "destructive" });
      e.target.value = "";
      return;
    }
    const tooBig = list.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (tooBig) {
      toast({ title: "Arquivo muito grande", description: `"${tooBig.name}" excede ${MAX_SIZE_MB}MB.`, variant: "destructive" });
      e.target.value = "";
      return;
    }
    setFiles(list);
  };

  const submitEvidence = async () => {
    if (!profileId || !dispute || !user) return;
    if (!message.trim() && files.length === 0) {
      toast({ title: "Adicione uma mensagem ou arquivo", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const path = `${user.id}/${dispute.id}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("dispute-evidence").upload(path, f);
        if (upErr) throw upErr;
        urls.push(path);
      }
      const { error } = await supabase.from("service_dispute_evidence").insert({
        dispute_id: dispute.id,
        submitted_by: profileId,
        message: message.trim() || null,
        file_urls: urls,
      });
      if (error) throw error;
      setMessage("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Evidência enviada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const closeDispute = async (action: "keep" | "withdraw") => {
    if (!dispute || !service || !profileId) return;
    setClosing(action);
    try {
      if (action === "withdraw") {
        // Apenas quem abriu pode retirar
        if (dispute.opened_by !== profileId) {
          throw new Error("Apenas quem abriu a disputa pode retirá-la");
        }
        await supabase.from("service_disputes").update({
          status: "closed_no_action",
          resolution: "Disputa retirada pela parte que abriu",
          resolved_at: new Date().toISOString(),
        }).eq("id", dispute.id);
        // Volta o serviço para o status anterior à disputa, se possível
        // Heurística: se foi 'completed' antes, volta para 'completed'; senão 'in_progress'
        const prev = [...history].reverse().find((h) => h.to_status !== "disputed")?.to_status;
        if (prev === "completed") {
          await transitionStatus(service.id, "confirmed").catch(() => {});
        }
      } else {
        // Manter — apenas marca em análise
        await supabase.from("service_disputes").update({
          status: "under_review",
        }).eq("id", dispute.id);
      }
      toast({ title: action === "keep" ? "Disputa mantida" : "Disputa encerrada" });
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setClosing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!dispute || !service) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-3xl pt-32 text-center">
          <p className="text-muted-foreground">Disputa não encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard?tab=service-orders")}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const isClient = profileId === service.client_id;
  const isOpener = profileId === dispute.opened_by;
  const isResolved = ["resolved_client", "resolved_provider", "resolved_split", "closed_no_action"].includes(dispute.status);

  // Timeline = histórico de status do serviço + evidências entrelaçados
  type TLEvent = {
    when: string;
    icon: any;
    iconClass: string;
    title: string;
    description?: string;
    actor?: string;
  };
  const timeline: TLEvent[] = [];
  timeline.push({
    when: service.created_at,
    icon: Wrench,
    iconClass: "bg-muted text-foreground",
    title: "Serviço criado",
    description: service.title,
  });
  history.forEach((h) => {
    timeline.push({
      when: h.created_at,
      icon: Clock,
      iconClass: "bg-primary/15 text-primary",
      title: `Status alterado: ${h.from_status ?? "—"} → ${h.to_status}`,
      description: h.reason ?? undefined,
    });
  });
  timeline.push({
    when: dispute.created_at,
    icon: AlertTriangle,
    iconClass: "bg-red-500/15 text-red-500",
    title: "Disputa aberta",
    description: dispute.reason,
  });
  evidence.forEach((e) => {
    const who = e.submitted_by === service.client_id ? "Cliente" : "Profissional";
    timeline.push({
      when: e.created_at,
      icon: FileText,
      iconClass: "bg-blue-500/15 text-blue-500",
      title: `${who} enviou evidência`,
      description: e.message ?? `${e.file_urls.length} arquivo(s) anexado(s)`,
      actor: who,
    });
  });
  if (dispute.resolved_at) {
    timeline.push({
      when: dispute.resolved_at,
      icon: ShieldCheck,
      iconClass: "bg-emerald-500/15 text-emerald-500",
      title: "Disputa encerrada",
      description: dispute.resolution ?? undefined,
    });
  }
  timeline.sort((a, b) => +new Date(a.when) - +new Date(b.when));

  const statusMeta = STATUS_LABEL[dispute.status] ?? STATUS_LABEL.open;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl px-4 sm:px-6 pt-24 pb-16 mx-auto">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h1 className="text-2xl font-bold font-display">Disputa de serviço</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Aberta em {new Date(dispute.created_at).toLocaleString("pt-BR")} por <span className="font-medium">{isOpener ? "você" : (isClient ? "Profissional" : "Cliente")}</span>
            </p>
          </div>
          <Badge variant="outline" className={`${statusMeta.className} self-start`}>
            {statusMeta.label}
          </Badge>
        </div>

        {/* Resumo do serviço */}
        <Card className="p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Serviço</p>
              <h2 className="font-semibold truncate">{service.title}</h2>
              {service.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
              )}
            </div>
            <ServiceStatusBadge status={service.status} />
          </div>
          <div className="flex items-center justify-between text-sm pt-3 border-t border-border">
            <span className="text-muted-foreground">
              {service.agreed_price ? `${service.currency} ${Number(service.agreed_price).toFixed(2)}` : "Preço a combinar"}
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="font-medium">Motivo:</span> {dispute.reason}
            </span>
          </div>
        </Card>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Coluna principal — Evidências */}
          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Evidências apresentadas ({evidence.length})
              </h3>

              {evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma evidência ainda. Use o formulário abaixo para enviar.
                </p>
              ) : (
                <div className="space-y-4">
                  {evidence.map((e) => {
                    const isMine = e.submitted_by === profileId;
                    const who = e.submitted_by === service.client_id ? "Cliente" : "Profissional";
                    return (
                      <div key={e.id} className={`p-3 rounded-xl border ${isMine ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            {who}{isMine ? " (você)" : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(e.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {e.message && <p className="text-sm whitespace-pre-wrap">{e.message}</p>}
                        {e.file_urls.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {e.file_urls.map((u, i) => (
                              <a
                                key={i}
                                href="#"
                                onClick={async (ev) => {
                                  ev.preventDefault();
                                  const { data } = await supabase.storage.from("dispute-evidence").createSignedUrl(u, 60);
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                }}
                                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-background border border-border hover:bg-muted"
                              >
                                <Paperclip className="w-3 h-3" />
                                {u.split("/").pop()?.slice(14)}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isResolved && (
                <>
                  <Separator className="my-5" />
                  <div className="space-y-3">
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Descreva sua versão, fatos, datas, comprovantes..."
                      rows={4}
                    />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={handleFiles}
                        />
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
                          <Paperclip className="w-4 h-4 mr-1" />
                          Anexar ({files.length})
                        </Button>
                        {files.length > 0 && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {files.map((f) => f.name).join(", ")}
                          </span>
                        )}
                      </div>
                      <Button onClick={submitEvidence} disabled={submitting} size="sm">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" /> Enviar evidência</>}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>

            {/* Ações de encerramento */}
            {!isResolved && (
              <Card className="p-5">
                <h3 className="font-semibold mb-2">Próximos passos</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Você pode <span className="font-medium">manter a disputa em análise</span> para que a moderação revise as evidências, ou {isOpener ? "retirar a disputa caso tenham chegado a um acordo" : "aguardar a moderação"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => closeDispute("keep")} disabled={closing !== null} variant="default" size="sm">
                    {closing === "keep" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Manter para análise</>}
                  </Button>
                  {isOpener && (
                    <Button onClick={() => closeDispute("withdraw")} disabled={closing !== null} variant="outline" size="sm">
                      {closing === "withdraw" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4 mr-1" /> Encerrar e retirar disputa</>}
                    </Button>
                  )}
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/chat">Conversar com a outra parte</Link>
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Timeline lateral */}
          <Card className="p-5 h-fit lg:sticky lg:top-24">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Linha do tempo
            </h3>
            <ol className="space-y-4 relative">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" aria-hidden />
              {timeline.map((ev, i) => {
                const Icon = ev.icon;
                return (
                  <li key={i} className="relative pl-9">
                    <span className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center ${ev.iconClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <p className="text-sm font-medium leading-tight">{ev.title}</p>
                    {ev.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{ev.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(ev.when).toLocaleString("pt-BR")}
                    </p>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ServiceDispute;
