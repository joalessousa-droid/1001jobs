// Página: KYC do usuário (wizard simplificado)
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { isValidCPF, formatCPF, onlyDigits } from "@/lib/validators";

type Status = "pending" | "in_review" | "approved" | "rejected";

export default function PerfilKyc() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<any>(null);
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [cnh, setCnh] = useState("");
  const [docFront, setDocFront] = useState<File | null>(null);
  const [docBack, setDocBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from("kyc_submissions")
      .select("*")
      .eq("user_id", u.user.id)
      .order("submitted_at", { ascending: false })
      .limit(1).maybeSingle();
    setSubmission(data);
    setLoading(false);
  }

  async function uploadFile(userId: string, file: File, label: string): Promise<string> {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${userId}/${Date.now()}-${label}.${ext}`;
    const { error } = await supabase.storage.from("kyc-docs").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  async function submit() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Faça login");
    if (!cpf || !docFront || !selfie) return toast.error("Envie CPF, frente do documento e selfie");
    const cpfDigits = onlyDigits(cpf);
    if (!isValidCPF(cpfDigits)) return toast.error("CPF inválido");
    setSubmitting(true);
    try {
      const front = await uploadFile(u.user.id, docFront, "doc-front");
      const back = docBack ? await uploadFile(u.user.id, docBack, "doc-back") : null;
      const slf = await uploadFile(u.user.id, selfie, "selfie");
      const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", u.user.id).maybeSingle();
      if (!prof) throw new Error("Perfil não encontrado");
      const { data: inserted, error } = await supabase.from("kyc_submissions").insert({
        profile_id: prof.id, user_id: u.user.id,
        cpf: cpfDigits, rg_number: rg || null, cnh_number: cnh || null,
        doc_front_path: front, doc_back_path: back, selfie_path: slf,
        status: "in_review",
      }).select("id").maybeSingle();
      if (error) throw error;

      // Dispara OCR, validação de CPF e e-mail em paralelo (não-bloqueante)
      if (inserted?.id) {
        Promise.allSettled([
          supabase.functions.invoke("kyc-ocr", { body: { submission_id: inserted.id } }),
          supabase.functions.invoke("cpf-check", { body: { submission_id: inserted.id, cpf: cpfDigits } }),
          supabase.functions.invoke("kyc-notify-email", { body: { submission_id: inserted.id } }),
        ]).catch(() => {});
      }

      toast.success("Documentos enviados. Análise em até 48h.");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar");
    } finally { setSubmitting(false); }
  }

  const statusBadge = (s: Status) => {
    const map: Record<Status, { label: string; cls: string }> = {
      pending: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
      in_review: { label: "Em análise", cls: "bg-blue-500/20 text-blue-300" },
      approved: { label: "Aprovado", cls: "bg-green-500/20 text-green-300" },
      rejected: { label: "Reprovado", cls: "bg-red-500/20 text-red-300" },
    };
    return <Badge className={map[s].cls}>{map[s].label}</Badge>;
  };

  if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Verificação de Identidade (KYC)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submission && (
            <div className="p-4 rounded-md bg-muted/50 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Última submissão</p>
                <p className="font-medium">{new Date(submission.submitted_at).toLocaleString("pt-BR")}</p>
                {submission.rejection_reason && (
                  <p className="text-sm text-red-400 mt-1">Motivo: {submission.rejection_reason}</p>
                )}
              </div>
              {statusBadge(submission.status as Status)}
            </div>
          )}

          {(!submission || submission.status === "rejected") && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><Label>CPF *</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
                <div><Label>RG</Label><Input value={rg} onChange={(e) => setRg(e.target.value)} /></div>
                <div><Label>CNH</Label><Input value={cnh} onChange={(e) => setCnh(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Documento (frente) *</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setDocFront(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <Label>Documento (verso)</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setDocBack(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <Label>Selfie *</Label>
                  <Input type="file" accept="image/*" capture="user" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <Button onClick={submit} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Enviar para análise
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
