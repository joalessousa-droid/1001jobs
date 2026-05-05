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

type PartnerLead = {
  id: string;
  name: string;
  email: string;
  institution: string;
  category: string;
  message: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const STATUSES = [
  { key: "new", label: "Nova" },
  { key: "contacted", label: "Em contato" },
  { key: "approved", label: "Aprovada" },
  { key: "rejected", label: "Recusada" },
];

const statusVariant = (s: string): "secondary" | "default" | "destructive" | "outline" => {
  if (s === "approved") return "default";
  if (s === "rejected") return "destructive";
  if (s === "contacted") return "outline";
  return "secondary";
};

const AdminPartnerLeads = () => {
  const { isAdmin, isModerator, loading } = useIsAdmin();
  const { toast } = useToast();
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Propostas de Parceria | Admin";
  }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from("partner_leads" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar propostas", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((data ?? []) as any);
  };

  useEffect(() => {
    if (isAdmin || isModerator) load();
  }, [isAdmin, isModerator]);

  const updateStatus = async (id: string, status: string) => {
    const lead = leads.find((l) => l.id === id);
    const previous_status = lead?.status;
    const { error } = await supabase.from("partner_leads" as any).update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    await logAuditEvent({
      action: "partner_lead_status_changed",
      entityType: "partner_lead",
      entityId: id,
      details: {
        previous_status,
        new_status: status,
        lead_email: lead?.email,
        institution: lead?.institution,
      },
    });
    toast({ title: "Status atualizado" });
    load();
  };

  const saveNotes = async (id: string, notes: string) => {
    const { error } = await supabase.from("partner_leads" as any).update({ notes }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao salvar nota", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nota salva" });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!isAdmin && !isModerator) return <Navigate to="/" replace />;

  const filtered = leads
    .filter((l) => filter === "all" || l.status === filter)
    .filter((l) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.institution.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
      );
    });

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s.key] = leads.filter((l) => l.status === s.key).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-6 py-24 max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold mb-2">Propostas de Parceria</h1>
          <p className="text-muted-foreground">{leads.length} propostas recebidas</p>
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
            placeholder="Buscar por nome, e-mail, instituição ou categoria..."
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
          {filtered.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                <div>
                  <p className="font-semibold">
                    {l.name}{" "}
                    <span className="text-muted-foreground font-normal">· {l.institution}</span>
                  </p>
                  <a href={`mailto:${l.email}`} className="text-sm text-primary hover:underline">
                    {l.email}
                  </a>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{l.category}</Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <Badge variant={statusVariant(l.status)}>
                  {STATUSES.find((s) => s.key === l.status)?.label ?? l.status}
                </Badge>
              </div>

              <p className="text-sm whitespace-pre-wrap text-foreground/90 mb-4">{l.message}</p>

              <div className="space-y-2 mb-3">
                <Input
                  placeholder="Notas internas..."
                  defaultValue={l.notes ?? ""}
                  onBlur={(e) => {
                    if ((e.target.value || "") !== (l.notes ?? "")) saveNotes(l.id, e.target.value);
                  }}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {STATUSES.filter((s) => s.key !== l.status).map((s) => (
                  <Button key={s.key} size="sm" variant="outline" onClick={() => updateStatus(l.id, s.key)}>
                    → {s.label}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Nenhuma proposta nesse filtro.</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminPartnerLeads;
