import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";

type Lead = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  status: string;
  created_at: string;
};

const STATUSES = ["new", "contacted", "qualified", "archived"];

const AdminInvestorLeads = () => {
  const { isAdmin, loading } = useIsAdmin();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => { document.title = "Leads RI | Admin"; }, []);

  const load = async () => {
    const q = supabase.from("investor_leads" as any).select("*").order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) toast({ title: "Erro ao carregar", variant: "destructive" });
    else setLeads((data ?? []) as any);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("investor_leads" as any).update({ status }).eq("id", id);
    if (error) toast({ title: "Erro ao atualizar", variant: "destructive" });
    else load();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-6 py-24 max-w-6xl">
        <h1 className="font-display text-3xl font-bold mb-2">Leads — Relações com Investidores</h1>
        <p className="text-muted-foreground mb-6">{leads.length} mensagens recebidas</p>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todos</Button>
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>{s}</Button>
          ))}
        </div>

        <div className="space-y-4">
          {filtered.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold">{l.name} {l.company && <span className="text-muted-foreground font-normal">· {l.company}</span>}</p>
                  <a href={`mailto:${l.email}`} className="text-sm text-primary hover:underline">{l.email}</a>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <Badge variant="secondary">{l.status}</Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap text-foreground/90 mb-3">{l.message}</p>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.filter((s) => s !== l.status).map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => updateStatus(l.id, s)}>→ {s}</Button>
                ))}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum lead nesse filtro.</p>}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminInvestorLeads;
