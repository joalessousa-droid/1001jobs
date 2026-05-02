import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";
import { logAuditEvent } from "@/lib/auditLog";

type Lead = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  status: string;
  created_at: string;
};

type Kpis = {
  ticket_medio: number | null;
  taxa_conclusao: number | null;
  tempo_aceite_seconds: number | null;
  recompra: number | null;
  gmv_anual: number | null;
  receita_anual: number | null;
};

const STATUSES = ["new", "contacted", "qualified", "archived"];
const KPI_FIELDS: (keyof Kpis)[] = [
  "ticket_medio", "taxa_conclusao", "tempo_aceite_seconds", "recompra", "gmv_anual", "receita_anual",
];

const AdminInvestorLeads = () => {
  const { isAdmin, loading } = useIsAdmin();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [kpis, setKpis] = useState<Kpis>({
    ticket_medio: null, taxa_conclusao: null, tempo_aceite_seconds: null,
    recompra: null, gmv_anual: null, receita_anual: null,
  });
  const [savingKpis, setSavingKpis] = useState(false);

  useEffect(() => { document.title = "Leads RI | Admin"; }, []);

  const load = async () => {
    const { data, error } = await supabase.from("investor_leads" as any)
      .select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar", variant: "destructive" });
    else setLeads((data ?? []) as any);

    const { data: k } = await supabase.from("investor_kpis" as any)
      .select("*").eq("id", 1).maybeSingle();
    if (k) setKpis(k as any);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const updateStatus = async (id: string, status: string) => {
    const lead = leads.find((l) => l.id === id);
    const previous_status = lead?.status;
    const { error } = await supabase.from("investor_leads" as any).update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
      return;
    }
    await logAuditEvent({
      action: "investor_lead_status_changed",
      entityType: "investor_lead",
      entityId: id,
      details: { previous_status, new_status: status, lead_email: lead?.email },
    });
    load();
  };

  const saveKpis = async () => {
    setSavingKpis(true);
    const { data: previous } = await supabase.from("investor_kpis" as any)
      .select("*").eq("id", 1).maybeSingle();

    const payload = { id: 1, ...kpis, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("investor_kpis" as any).upsert(payload);
    setSavingKpis(false);
    if (error) {
      toast({ title: "Erro ao salvar KPIs", variant: "destructive" });
      return;
    }

    const changes: Record<string, { from: any; to: any }> = {};
    for (const f of KPI_FIELDS) {
      const prev = (previous as any)?.[f] ?? null;
      const next = kpis[f] ?? null;
      if (Number(prev) !== Number(next)) changes[f] = { from: prev, to: next };
    }
    await logAuditEvent({
      action: "investor_kpis_updated",
      entityType: "investor_kpis",
      entityId: "1",
      details: { changes },
    });
    toast({ title: "KPIs atualizados" });
    load();
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

        <Card className="p-5 mb-8">
          <h2 className="font-semibold mb-4">KPIs (override manual)</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {KPI_FIELDS.map((f) => (
              <div key={f}>
                <Label className="text-xs">{f}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={kpis[f] ?? ""}
                  onChange={(e) => setKpis({ ...kpis, [f]: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <Button className="mt-4" onClick={saveKpis} disabled={savingKpis}>
            {savingKpis ? "Salvando..." : "Salvar KPIs"}
          </Button>
        </Card>

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
