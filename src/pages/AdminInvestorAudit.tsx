import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate, Link } from "react-router-dom";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";

type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
};

type Lead = { id: string; name: string; email: string };

const KPI_LABELS: Record<string, string> = {
  ticket_medio: "Ticket Médio",
  taxa_conclusao: "Taxa de Conclusão",
  tempo_aceite_seconds: "Tempo de Aceite (s)",
  recompra: "Recompra",
  gmv_anual: "GMV Anual",
  receita_anual: "Receita Anual",
};

const formatVal = (v: any) => (v === null || v === undefined ? "—" : String(v));

const AdminInvestorAudit = () => {
  const { isAdmin, loading } = useIsAdmin();
  const [leadLogs, setLeadLogs] = useState<AuditLog[]>([]);
  const [kpiLogs, setKpiLogs] = useState<AuditLog[]>([]);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [actors, setActors] = useState<Record<string, { name: string; email: string }>>({});
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.title = "Auditoria RI | Admin";
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .in("action", ["investor_lead_status_changed", "investor_kpis_updated"])
        .order("created_at", { ascending: false })
        .limit(500);
      const all = (data ?? []) as AuditLog[];
      setLeadLogs(all.filter((l) => l.action === "investor_lead_status_changed"));
      setKpiLogs(all.filter((l) => l.action === "investor_kpis_updated"));

      // Resolve lead refs
      const leadIds = Array.from(
        new Set(all.filter((l) => l.entity_type === "investor_lead" && l.entity_id).map((l) => l.entity_id!)),
      );
      if (leadIds.length) {
        const { data: ld } = await supabase
          .from("investor_leads" as any)
          .select("id, name, email")
          .in("id", leadIds);
        const map: Record<string, Lead> = {};
        (ld ?? []).forEach((r: any) => (map[r.id] = r));
        setLeads(map);
      }

      // Resolve actors
      const userIds = Array.from(new Set(all.map((l) => l.user_id).filter(Boolean))) as string[];
      if (userIds.length) {
        const { data: pr } = await supabase
          .from("profiles")
          .select("user_id, display_name, representative_email")
          .in("user_id", userIds);
        const map: Record<string, { name: string; email: string }> = {};
        (pr ?? []).forEach((p: any) => {
          map[p.user_id] = { name: p.display_name || "—", email: p.representative_email || "" };
        });
        setActors(map);
      }
    })();
  }, [isAdmin]);

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const filterFn = (l: AuditLog) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const lead = l.entity_id ? leads[l.entity_id] : null;
    const actor = l.user_id ? actors[l.user_id] : null;
    return (
      l.id.includes(q) ||
      l.entity_id?.toLowerCase().includes(q) ||
      lead?.name.toLowerCase().includes(q) ||
      lead?.email.toLowerCase().includes(q) ||
      actor?.name.toLowerCase().includes(q) ||
      actor?.email.toLowerCase().includes(q) ||
      JSON.stringify(l.details ?? {})
        .toLowerCase()
        .includes(q)
    );
  };

  const filteredLeadLogs = useMemo(() => leadLogs.filter(filterFn), [leadLogs, search, leads, actors]);
  const filteredKpiLogs = useMemo(() => kpiLogs.filter(filterFn), [kpiLogs, search, actors]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-6 py-24 max-w-6xl">
        <Link to="/admin/investidores" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para leads
        </Link>
        <h1 className="font-display text-3xl font-bold mb-2">Auditoria — Relações com Investidores</h1>
        <p className="text-muted-foreground mb-6">
          {leadLogs.length} eventos de leads · {kpiLogs.length} alterações de KPIs
        </p>

        <Input
          placeholder="Buscar por nome, e-mail, ID, campo alterado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-6 max-w-xl"
        />

        <Tabs defaultValue="leads">
          <TabsList>
            <TabsTrigger value="leads">Eventos por Lead ({filteredLeadLogs.length})</TabsTrigger>
            <TabsTrigger value="kpis">Alterações de KPIs ({filteredKpiLogs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-6 space-y-3">
            {filteredLeadLogs.map((l) => {
              const lead = l.entity_id ? leads[l.entity_id] : null;
              const actor = l.user_id ? actors[l.user_id] : null;
              const open = !!expanded[l.id];
              return (
                <Card key={l.id} className="p-4">
                  <button onClick={() => toggle(l.id)} className="w-full flex items-start justify-between gap-3 text-left">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-semibold">{lead?.name ?? "Lead removido"}</span>
                        {lead?.email && <span className="text-sm text-muted-foreground">· {lead.email}</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-sm pl-6">
                        <Badge variant="outline">{l.details?.previous_status ?? "—"}</Badge>
                        <span>→</span>
                        <Badge>{l.details?.new_status ?? "—"}</Badge>
                        <span className="text-muted-foreground">por {actor?.name ?? "Sistema"}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </span>
                  </button>
                  {open && (
                    <div className="mt-4 pl-6 space-y-2 text-xs">
                      <div><strong>Lead ID:</strong> <code>{l.entity_id}</code></div>
                      <div><strong>Ator:</strong> {actor?.email || l.user_id}</div>
                      <div><strong>User Agent:</strong> {l.user_agent || "—"}</div>
                      <pre className="bg-muted p-3 rounded overflow-auto">{JSON.stringify(l.details, null, 2)}</pre>
                    </div>
                  )}
                </Card>
              );
            })}
            {filteredLeadLogs.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Nenhum evento encontrado.</p>
            )}
          </TabsContent>

          <TabsContent value="kpis" className="mt-6 space-y-3">
            {filteredKpiLogs.map((l) => {
              const actor = l.user_id ? actors[l.user_id] : null;
              const changes = (l.details?.changes ?? {}) as Record<string, { from: any; to: any }>;
              const fields = Object.keys(changes);
              const open = !!expanded[l.id];
              return (
                <Card key={l.id} className="p-4">
                  <button onClick={() => toggle(l.id)} className="w-full flex items-start justify-between gap-3 text-left">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-semibold">
                          {fields.length === 0 ? "Nenhuma alteração" : `${fields.length} campo(s) alterado(s)`}
                        </span>
                      </div>
                      <div className="pl-6 text-sm flex gap-1.5 flex-wrap">
                        {fields.map((f) => (
                          <Badge key={f} variant="secondary">{KPI_LABELS[f] ?? f}</Badge>
                        ))}
                        <span className="text-muted-foreground ml-1">por {actor?.name ?? "Sistema"}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </span>
                  </button>
                  {open && (
                    <div className="mt-4 pl-6 space-y-3 text-sm">
                      <div className="text-xs"><strong>Ator:</strong> {actor?.email || l.user_id}</div>
                      <div className="border rounded overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-2">Campo</th>
                              <th className="text-left p-2">De</th>
                              <th className="text-left p-2">Para</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fields.map((f) => (
                              <tr key={f} className="border-t">
                                <td className="p-2 font-medium">{KPI_LABELS[f] ?? f}</td>
                                <td className="p-2 text-muted-foreground">{formatVal(changes[f].from)}</td>
                                <td className="p-2">{formatVal(changes[f].to)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            {filteredKpiLogs.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Nenhuma alteração de KPI encontrada.</p>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default AdminInvestorAudit;
