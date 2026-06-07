// Admin: fila de KYC para aprovar/reprovar
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Eye, RefreshCw } from "lucide-react";

export default function AdminKyc() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("in_review");
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<string>("");
  const [audit, setAudit] = useState<any[]>([]);
  const [cpfLogs, setCpfLogs] = useState<any[]>([]);
  const [reprocessing, setReprocessing] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    let q = supabase.from("kyc_submissions").select("*").order("submitted_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q.limit(200);
    setItems(data ?? []);
    setLoading(false);
  }

  async function signed(path: string | null) {
    if (!path) return null;
    if (urls[path]) return urls[path];
    const { data } = await supabase.storage.from("kyc-docs").createSignedUrl(path, 300);
    if (data?.signedUrl) {
      setUrls((u) => ({ ...u, [path]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  }

  function suggestCategory(s: any): string {
    if (s?.cpf_regularidade === "irregular") return "cpf_irregular";
    if (s?.ocr_checked_at && s?.ocr_cpf_match === false) return "name_cpf_mismatch";
    if (s?.ocr_checked_at && (s?.ocr_name_match ?? 1) < 0.6) return "name_cpf_mismatch";
    if (s?.face_match_score != null && Number(s.face_match_score) < 0.7) return "face_mismatch";
    if (s?.ocr_checked_at && !s?.ocr_extracted?.name) return "ocr_inconclusive";
    return "other";
  }

  async function loadAudit(submissionId: string) {
    const [{ data: decisions }, { data: logs }] = await Promise.all([
      supabase.from("kyc_decisions").select("*").eq("submission_id", submissionId)
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("audit_logs").select("*")
        .eq("entity_type", "kyc_submission").eq("entity_id", submissionId)
        .ilike("action", "cpf_check.%")
        .order("created_at", { ascending: false }).limit(20),
    ]);
    setAudit(decisions ?? []);
    setCpfLogs(logs ?? []);
  }

  async function reprocessCpf(s: any) {
    setReprocessing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const operator_id = u?.user?.id ?? null;
      const t0 = Date.now();
      const { error } = await supabase.functions.invoke("cpf-check", {
        body: { submission_id: s.id, cpf: s.cpf, operator_id, reason: "admin_reprocess" },
      });
      // Trilha de auditoria: registra a ação do operador (independente do resultado)
      await supabase.from("audit_logs").insert({
        action: "kyc.reprocess_cpf", entity_type: "kyc_submission", entity_id: s.id,
        user_id: operator_id,
        details: { triggered_at: new Date().toISOString(), elapsed_ms: Date.now() - t0, ok: !error },
      });
      if (error) toast.error("Falha ao reprocessar CPF");
      else {
        toast.success("CPF reprocessado");
        // Recarrega a submissão + auditoria
        const { data: fresh } = await supabase.from("kyc_submissions").select("*").eq("id", s.id).maybeSingle();
        if (fresh) {
          setSelected(fresh);
          setCategory(suggestCategory(fresh));
        }
        await loadAudit(s.id);
        load();
      }
    } finally { setReprocessing(false); }
  }

  async function decide(s: any, status: "approved" | "rejected") {
    if (status === "rejected" && !reason.trim()) return toast.error("Informe o motivo");
    if (status === "rejected" && !category) return toast.error("Selecione a categoria");
    if (status === "approved" && s.cpf_regularidade === "irregular") {
      return toast.error("CPF irregular na Receita — não é possível aprovar");
    }
    const { error } = await supabase.from("kyc_submissions").update({
      status,
      rejection_reason: status === "rejected" ? reason : null,
      rejection_category: status === "rejected" ? category : null,
      decided_at: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) return toast.error(error.message);
    if (status === "approved") {
      await supabase.from("profiles").update({ verification_status: "verified" }).eq("id", s.profile_id);
    }
    supabase.functions.invoke("kyc-notify-email", { body: { submission_id: s.id } }).catch(() => {});
    toast.success(status === "approved" ? "Aprovado" : "Reprovado");
    setSelected(null); setReason(""); setCategory("");
    load();
  }

  async function rerunOcr(s: any) {
    toast.info("Reexecutando OCR...");
    const { error } = await supabase.functions.invoke("kyc-ocr", { body: { submission_id: s.id } });
    if (error) toast.error("Falha no OCR"); else { toast.success("OCR atualizado"); load(); }
  }


  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold">KYC — Fila de análise</h1>
      <div className="flex gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="in_review">Em análise</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Reprovado</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <Loader2 className="animate-spin" /> : (
        <div className="grid gap-3">
          {items.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge>{s.status}</Badge>
                    <span className="text-sm text-muted-foreground">CPF: {s.cpf ?? "-"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviado em {new Date(s.submitted_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={async () => {
                  setSelected(s);
                  setCategory(suggestCategory(s));
                  await Promise.all([
                    ...[s.doc_front_path, s.doc_back_path, s.selfie_path].map(signed),
                    loadAudit(s.id),
                  ]);
                }}>
                  <Eye className="h-4 w-4 mr-1" /> Analisar
                </Button>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-muted-foreground">Nenhuma submissão.</p>}
        </div>
      )}

      {selected && (
        <Card className="border-primary">
          <CardHeader><CardTitle>Análise — {selected.cpf}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {["doc_front_path","doc_back_path","selfie_path"].map((k) => (
                <div key={k} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{k.replace("_path","")}</p>
                  {selected[k] && urls[selected[k]] ? (
                    <img src={urls[selected[k]]} alt={k} className="w-full h-40 object-cover rounded" />
                  ) : <div className="h-40 bg-muted rounded" />}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-muted/40">
                <p className="text-muted-foreground">CPF Receita</p>
                <p className={selected.cpf_regularidade === "regular" ? "text-green-400 font-medium" : selected.cpf_regularidade === "irregular" ? "text-red-400 font-medium" : "text-muted-foreground"}>
                  {selected.cpf_regularidade ?? "—"}
                </p>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <p className="text-muted-foreground">CPF no doc.</p>
                <p className={selected.ocr_cpf_match ? "text-green-400 font-medium" : selected.ocr_checked_at ? "text-red-400 font-medium" : "text-muted-foreground"}>
                  {selected.ocr_checked_at ? (selected.ocr_cpf_match ? "OK" : "DIVERGE") : "—"}
                </p>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <p className="text-muted-foreground">Nome match</p>
                <p className="font-medium">{Math.round((selected.ocr_name_match ?? 0) * 100)}%</p>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <p className="text-muted-foreground">OCR extraído</p>
                <p className="font-medium truncate">{selected.ocr_extracted?.name ?? "—"}</p>
              </div>
            </div>

            {selected.cpf_regularidade === "irregular" && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                CPF irregular na Receita — aprovação bloqueada.
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Categoria do motivo (se reprovar)</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ocr_inconclusive">OCR inconclusivo</SelectItem>
                  <SelectItem value="cpf_irregular">CPF irregular na Receita</SelectItem>
                  <SelectItem value="name_cpf_mismatch">Divergência CPF/nome</SelectItem>
                  <SelectItem value="face_mismatch">Biometria facial divergente</SelectItem>
                  <SelectItem value="document_invalid">Documento inválido</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea placeholder="Motivo (obrigatório se reprovar)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => decide(selected, "approved")} className="flex-1" disabled={selected.cpf_regularidade === "irregular"}>
                <CheckCircle2 className="h-4 w-4 mr-2" />Aprovar
              </Button>
              <Button onClick={() => decide(selected, "rejected")} variant="destructive" className="flex-1">
                <XCircle className="h-4 w-4 mr-2" />Reprovar
              </Button>
              <Button onClick={() => rerunOcr(selected)} variant="secondary">Reexecutar OCR</Button>
              <Button onClick={() => reprocessCpf(selected)} variant="secondary" disabled={reprocessing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${reprocessing ? "animate-spin" : ""}`} />Reprocessar CPF
              </Button>
              <Button onClick={() => setSelected(null)} variant="ghost">Cancelar</Button>
            </div>

            {cpfLogs.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-sm font-medium mb-2">Resumo cpf-check</p>
                <ul className="space-y-1 text-xs max-h-48 overflow-auto">
                  {cpfLogs.map((l) => {
                    const d = l.details ?? {};
                    const att = Array.isArray(d.attempts) ? d.attempts : [];
                    const last = att[att.length - 1];
                    return (
                      <li key={l.id} className="border-b border-border/60 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{l.action.replace("cpf_check.","")}</Badge>
                          <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="text-muted-foreground mt-1 grid grid-cols-2 md:grid-cols-4 gap-1">
                          <span>provider: <b className="text-foreground">{d.provider ?? "—"}</b></span>
                          <span>regularidade: <b className="text-foreground">{d.regularidade ?? "—"}</b></span>
                          <span>tentativas: <b className="text-foreground">{d.total_attempts ?? att.length ?? 0}</b></span>
                          <span>latência: <b className="text-foreground">{d.total_latency_ms ?? "—"}ms</b></span>
                          {last?.status != null && <span>último status: <b className="text-foreground">{last.status}</b></span>}
                          {d.fallback_reason && <span className="col-span-2">fallback: <b className="text-red-300">{d.fallback_reason}</b></span>}
                          {d.trigger_reason && <span>trigger: <b className="text-foreground">{d.trigger_reason}</b></span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {audit.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-sm font-medium mb-2">Trilha de auditoria</p>
                <ul className="space-y-1 text-xs max-h-56 overflow-auto">
                  {audit.map((a) => (
                    <li key={a.id} className="grid grid-cols-12 gap-2 border-b border-border/60 py-1">
                      <span className="col-span-3 text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                      <span className="col-span-2"><Badge variant="outline">{a.from_status ?? "—"} → {a.to_status}</Badge></span>
                      <span className="col-span-2 truncate">{a.rejection_category ?? "—"}</span>
                      <span className="col-span-3 truncate">{a.reason ?? ""}</span>
                      <span className="col-span-2 truncate text-muted-foreground">{a.operator_id ? a.operator_id.slice(0, 8) : "sistema"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
