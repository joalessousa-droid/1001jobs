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
import { Loader2, CheckCircle2, XCircle, Eye } from "lucide-react";

export default function AdminKyc() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("in_review");
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState("");
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

  async function decide(s: any, status: "approved" | "rejected") {
    if (status === "rejected" && !reason.trim()) return toast.error("Informe o motivo");
    if (status === "approved" && s.cpf_regularidade === "irregular") {
      return toast.error("CPF irregular na Receita — não é possível aprovar");
    }
    const { error } = await supabase.from("kyc_submissions").update({
      status, rejection_reason: status === "rejected" ? reason : null,
      decided_at: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) return toast.error(error.message);
    if (status === "approved") {
      await supabase.from("profiles").update({ verification_status: "verified" }).eq("id", s.profile_id);
    }
    // dispara e-mail de status (não bloqueante)
    supabase.functions.invoke("kyc-notify-email", { body: { submission_id: s.id } }).catch(() => {});
    toast.success(status === "approved" ? "Aprovado" : "Reprovado");
    setSelected(null); setReason("");
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
                  await Promise.all([s.doc_front_path, s.doc_back_path, s.selfie_path].map(signed));
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

            <Textarea placeholder="Motivo (obrigatório se reprovar)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => decide(selected, "approved")} className="flex-1" disabled={selected.cpf_regularidade === "irregular"}>
                <CheckCircle2 className="h-4 w-4 mr-2" />Aprovar
              </Button>
              <Button onClick={() => decide(selected, "rejected")} variant="destructive" className="flex-1">
                <XCircle className="h-4 w-4 mr-2" />Reprovar
              </Button>
              <Button onClick={() => rerunOcr(selected)} variant="secondary">Reexecutar OCR</Button>
              <Button onClick={() => setSelected(null)} variant="ghost">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
