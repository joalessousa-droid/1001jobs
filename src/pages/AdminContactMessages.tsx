import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { logAuditEvent } from "@/lib/auditLog";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  notes: string | null;
  user_agent: string | null;
  referrer: string | null;
  created_at: string;
};

const STATUSES = [
  { key: "new", label: "Nova" },
  { key: "in_progress", label: "Em atendimento" },
  { key: "resolved", label: "Resolvida" },
  { key: "spam", label: "Spam" },
];

const statusVariant = (s: string): "secondary" | "default" | "destructive" | "outline" => {
  if (s === "resolved") return "default";
  if (s === "spam") return "destructive";
  if (s === "in_progress") return "outline";
  return "secondary";
};

const AdminContactMessages = () => {
  const { isAdmin, isModerator, loading } = useIsAdmin();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Mensagens de Contato | Admin";
  }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from("contact_messages" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar mensagens", description: error.message, variant: "destructive" });
      return;
    }
    setMessages((data ?? []) as any);
  };

  useEffect(() => {
    if (isAdmin || isModerator) load();
  }, [isAdmin, isModerator]);

  const updateStatus = async (id: string, status: string) => {
    const msg = messages.find((m) => m.id === id);
    const previous_status = msg?.status;
    const { error } = await supabase.from("contact_messages" as any).update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    await logAuditEvent({
      action: "contact_message_status_changed",
      entityType: "contact_message",
      entityId: id,
      details: {
        previous_status,
        new_status: status,
        sender_email: msg?.email,
        subject: msg?.subject,
      },
    });
    toast({ title: "Status atualizado" });
    load();
  };

  const saveNotes = async (id: string, notes: string) => {
    const { error } = await supabase.from("contact_messages" as any).update({ notes }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao salvar nota", description: error.message, variant: "destructive" });
      return;
    }
    await logAuditEvent({
      action: "contact_message_note_updated",
      entityType: "contact_message",
      entityId: id,
      details: { notes_length: notes.length },
    });
    toast({ title: "Nota salva" });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!isAdmin && !isModerator) return <Navigate to="/" replace />;

  const filtered = messages
    .filter((m) => filter === "all" || m.status === filter)
    .filter((m) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.subject ?? "").toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    });

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s.key] = messages.filter((m) => m.status === s.key).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-6 py-24 max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold mb-2">Mensagens de Contato</h1>
          <p className="text-muted-foreground">{messages.length} mensagens recebidas</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {STATUSES.map((s) => (
            <Card key={s.key} className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{counts[s.key] ?? 0}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <Input
            placeholder="Buscar por nome, e-mail, assunto ou mensagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-md"
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
              Todas
            </Button>
            {STATUSES.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={filter === s.key ? "default" : "outline"}
                onClick={() => setFilter(s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filtered.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                <div>
                  <p className="font-semibold">
                    {m.name}
                    {m.subject && <span className="text-muted-foreground font-normal"> · {m.subject}</span>}
                  </p>
                  <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline">
                    {m.email}
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                    {m.referrer ? ` · de ${m.referrer}` : ""}
                  </p>
                </div>
                <Badge variant={statusVariant(m.status)}>
                  {STATUSES.find((s) => s.key === m.status)?.label ?? m.status}
                </Badge>
              </div>

              <p className="text-sm whitespace-pre-wrap text-foreground/90 mb-4">{m.message}</p>

              <div className="space-y-2 mb-3">
                <Input
                  placeholder="Notas internas..."
                  defaultValue={m.notes ?? ""}
                  onBlur={(e) => {
                    if ((e.target.value || "") !== (m.notes ?? "")) saveNotes(m.id, e.target.value);
                  }}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {STATUSES.filter((s) => s.key !== m.status).map((s) => (
                  <Button key={s.key} size="sm" variant="outline" onClick={() => updateStatus(m.id, s.key)}>
                    → {s.label}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Nenhuma mensagem nesse filtro.</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminContactMessages;
