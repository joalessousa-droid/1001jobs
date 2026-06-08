// Timeline de eventos do sinistro + caixa de comentário admin.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Clock, FilePlus, FileMinus, ArrowRightCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<string, any> = {
  opened: ShieldCheck,
  attachment_added: FilePlus,
  attachment_removed: FileMinus,
  status_changed: ArrowRightCircle,
  comment: MessageSquare,
  resolution: ShieldCheck,
};

export function ClaimTimeline({ claimId, canComment = false }: { claimId: string; canComment?: boolean }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("insurance_claim_events")
      .select("*")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true });
    setEvents(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`claim-events-${claimId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "insurance_claim_events", filter: `claim_id=eq.${claimId}` },
        (payload) => setEvents((prev) => [...prev, payload.new as any]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [claimId]);

  async function addComment() {
    if (msg.trim().length < 1) return;
    setSending(true);
    const { error } = await supabase.rpc("add_insurance_claim_comment", {
      _claim_id: claimId, _message: msg.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setMsg(""); toast.success("Comentário publicado");
    // Notifica claimant + admins por e-mail
    supabase.functions.invoke("insurance-notify", {
      body: { claim_id: claimId, event_type: "comment", message: msg.trim() },
    }).catch(() => {});
  }

  async function addComment() {
    if (msg.trim().length < 1) return;
    setSending(true);
    const { error } = await supabase.rpc("add_insurance_claim_comment", {
      _claim_id: claimId, _message: msg.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setMsg(""); toast.success("Comentário publicado");
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Linha do tempo</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading ? <Loader2 className="animate-spin" /> : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem eventos.</p>
        ) : (
          <ol className="relative border-l border-border pl-4 space-y-3">
            {events.map((e) => {
              const Icon = ICONS[e.event_type] ?? Clock;
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[22px] top-1 bg-background border border-border rounded-full p-1">
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <time>{new Date(e.created_at).toLocaleString("pt-BR")}</time>
                    {e.is_admin && <Badge variant="outline" className="text-[10px]">admin</Badge>}
                    <span className="uppercase tracking-wide">{e.event_type}</span>
                  </div>
                  {e.message && <p className="text-sm mt-1">{e.message}</p>}
                </li>
              );
            })}
          </ol>
        )}

        {canComment && (
          <div className="pt-3 border-t border-border space-y-2">
            <Textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Comentar como administrador…"
              rows={2}
              maxLength={1000}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={addComment} disabled={sending || msg.trim().length < 1}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar comentário"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
