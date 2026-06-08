// Módulo 11 — Detalhe do sinistro: anexos (fotos/vídeos/documentos) e acompanhamento.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Image as ImageIcon, Video, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ClaimTimeline } from "@/components/insurance/ClaimTimeline";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { detectMimeFromContent, validateAttachmentClient, parseInsuranceError, ATTACHMENT_LIMITS } from "@/lib/insurance-errors";

const MAX_FILES = ATTACHMENT_LIMITS.maxFiles;

const KIND_BY_MIME = (m: string) =>
  m.startsWith("image/") ? "photo" : m.startsWith("video/") ? "video" : "document";


export default function InsuranceClaimDetail() {
  const { id } = useParams();
  const { isAdmin, isModerator } = useIsAdmin();
  const [claim, setClaim] = useState<any>(null);
  const [atts, setAtts] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  async function load() {
    if (!id) return;
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("insurance_claims").select("*").eq("id", id).maybeSingle(),
      supabase.from("insurance_claim_attachments").select("*").eq("claim_id", id).order("created_at", { ascending: false }),
    ]);
    setClaim(c); setAtts(a ?? []);
    const next: Record<string, string> = {};
    for (const att of (a ?? [])) {
      const { data: signed } = await supabase.storage.from("insurance-claims").createSignedUrl(att.file_path, 600);
      if (signed?.signedUrl) next[att.id] = signed.signedUrl;
    }
    setUrls(next);
  }
  useEffect(() => { load(); }, [id]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !id) return;
    const detected = await detectMimeFromContent(file);
    const totalBytes = atts.reduce((s, a) => s + (a.size_bytes || 0), 0);
    const v = validateAttachmentClient(file, atts.length, totalBytes, detected);
    if (!v.ok) { e.target.value = ""; return toast.error(v.message); }
    const effectiveMime = detected || file.type;

    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id; if (!uid) { setUploading(false); return toast.error("Não autenticado"); }
    const path = `${uid}/${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("insurance-claims").upload(path, file, { contentType: effectiveMime });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("insurance_claim_attachments").insert({
      claim_id: id, kind: KIND_BY_MIME(effectiveMime) as any,
      file_path: path, mime_type: effectiveMime, size_bytes: file.size, uploaded_by: uid, file_name: file.name,
    } as any);
    setUploading(false);
    if (error) {
      await supabase.storage.from("insurance-claims").remove([path]).catch(() => {});
      const parsed = parseInsuranceError(error);
      return toast.error(parsed.message + (parsed.detail ? ` (${parsed.detail})` : ""));
    }
    toast.success("Anexo enviado");
    e.target.value = "";
    load();
  }


  async function remove(att: any) {
    if (!confirm("Remover anexo?")) return;
    await supabase.storage.from("insurance-claims").remove([att.file_path]);
    await supabase.from("insurance_claim_attachments").delete().eq("id", att.id);
    load();
  }

  if (!claim) return <div className="container py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container mx-auto py-8 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sinistro {claim.protocol}</span>
            <Badge variant="outline">{claim.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><b>Descrição:</b> {claim.description}</p>
          <p><b>Ocorrência:</b> {new Date(claim.occurrence_date).toLocaleString()}</p>
          {claim.estimated_amount && <p><b>Valor estimado:</b> R$ {Number(claim.estimated_amount).toFixed(2)}</p>}
          {claim.resolution_notes && <p><b>Resposta:</b> {claim.resolution_notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Anexos ({atts.length}/{MAX_FILES})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,.pdf,.doc,.docx"
            onChange={onUpload}
            disabled={uploading || atts.length >= MAX_FILES}
            data-testid="claim-upload-input"
          />
          <p className="text-xs text-muted-foreground">
            Até {MAX_FILES} arquivos · 50MB máx · JPG/PNG/WebP/GIF, MP4/MOV/WebM, PDF/DOC/DOCX.
          </p>
          {uploading && <Loader2 className="animate-spin" />}
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {atts.map((a) => (
              <li key={a.id} className="border border-border rounded-md p-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    {a.kind === "photo" ? <ImageIcon className="h-3 w-3" /> : a.kind === "video" ? <Video className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {a.kind}
                  </span>
                  <button onClick={() => remove(a)} className="text-red-500"><Trash2 className="h-3 w-3" /></button>
                </div>
                {a.kind === "photo" && urls[a.id] && <img src={urls[a.id]} className="w-full h-32 object-cover rounded" alt="" />}
                {a.kind === "video" && urls[a.id] && <video src={urls[a.id]} className="w-full h-32 rounded" controls />}
                {a.kind === "document" && urls[a.id] && <a className="text-xs underline" href={urls[a.id]} target="_blank" rel="noreferrer">Abrir documento</a>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ClaimTimeline claimId={claim.id} canComment={isAdmin || isModerator} />
    </div>
  );
}
