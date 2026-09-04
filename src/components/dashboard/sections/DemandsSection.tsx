import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Trash2, Loader2, CheckCircle, Clock, XCircle, MessageCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { excludeRadarRequests } from "@/lib/radarVisibility";

interface Props {
  profileId: string;
}

interface TaskApplication {
  id: string;
  service_request_id: string;
  applicant_profile_id: string;
  conversation_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  service_request?: {
    description: string;
    budget: number | null;
    city: string | null;
    state: string | null;
    requester_name: string;
    requester_type: string;
    is_active: boolean;
    service_categories: { name: string } | null;
  };
  applicant?: {
    display_name: string;
    avatar_url: string | null;
  };
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" | "destructive"; color: string }> = {
  pending: { label: "Pendente", icon: Clock, variant: "secondary", color: "text-yellow-600" },
  accepted: { label: "Aceita", icon: CheckCircle, variant: "default", color: "text-green-600" },
  rejected: { label: "Rejeitada", icon: XCircle, variant: "destructive", color: "text-red-500" },
  completed: { label: "Concluída", icon: CheckCircle, variant: "outline", color: "text-blue-600" },
};

const DemandsSection = ({ profileId }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [demands, setDemands] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<TaskApplication[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<TaskApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("my-tasks");

  const fetchDemands = async () => {
    const { data } = await supabase
      .from("service_requests")
      .select("*, service_categories(name)")
      .eq("profile_id", profileId)
      .neq("origin", "radar")
      .order("created_at", { ascending: false });
    setDemands(excludeRadarRequests((data ?? []) as any[], "dashboard-demands") as any);
  };

  const fetchMyApplications = async () => {
    const { data } = await supabase
      .from("task_applications")
      .select("*")
      .eq("applicant_profile_id", profileId)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const requestIds = [...new Set(data.map((a: any) => a.service_request_id))];
      const { data: requests } = await supabase
        .from("service_requests")
        .select("id, description, budget, city, state, requester_name, requester_type, is_active, service_categories(name)")
        .in("id", requestIds);

      const requestMap = new Map((requests || []).map((r: any) => [r.id, r]));
      setMyApplications(
        data.map((a: any) => ({
          ...a,
          service_request: requestMap.get(a.service_request_id) || null,
        }))
      );
    } else {
      setMyApplications([]);
    }
  };

  const fetchReceivedApplications = async () => {
    // Get my service request IDs first
    const { data: myRequests } = await supabase
      .from("service_requests")
      .select("id")
      .eq("profile_id", profileId);

    if (!myRequests || myRequests.length === 0) {
      setReceivedApplications([]);
      return;
    }

    const requestIds = myRequests.map((r: any) => r.id);
    const { data } = await supabase
      .from("task_applications")
      .select("*")
      .in("service_request_id", requestIds)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Fetch service request details
      const { data: requests } = await supabase
        .from("service_requests")
        .select("id, description, budget, city, state, requester_name, requester_type, is_active, service_categories(name)")
        .in("id", requestIds);

      // Fetch applicant profiles
      const applicantIds = [...new Set(data.map((a: any) => a.applicant_profile_id))];
      const { data: applicants } = await (supabase as any)
        .from("public_profiles")
        .select("id, display_name, avatar_url")
        .in("id", applicantIds);

      const requestMap = new Map((requests || []).map((r: any) => [r.id, r]));
      const applicantMap = new Map((applicants || []).map((p: any) => [p.id, p]));

      setReceivedApplications(
        data.map((a: any) => ({
          ...a,
          service_request: requestMap.get(a.service_request_id) || null,
          applicant: applicantMap.get(a.applicant_profile_id) || null,
        }))
      );
    } else {
      setReceivedApplications([]);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchDemands(), fetchMyApplications(), fetchReceivedApplications()]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [profileId]);

  // Realtime subscription for application status changes
  useEffect(() => {
    const channel = supabase
      .channel('task-applications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_applications',
        },
        (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;
          
          // Notify applicant when their application status changes
          if (updated.applicant_profile_id === profileId && old.status !== updated.status) {
            const statusLabels: Record<string, string> = {
              accepted: '🎉 Sua candidatura foi aceita!',
              rejected: '❌ Sua candidatura foi rejeitada.',
              completed: '✅ Tarefa marcada como concluída!',
            };
            const msg = statusLabels[updated.status];
            if (msg) {
              toast({ title: msg, description: 'Atualizando dados...' });
            }
          }
          
          // Notify task owner when new application arrives
          if (updated.status === 'pending' && old.status !== 'pending') {
            // This handles inserts via UPDATE (upsert)
          }
          
          // Refresh data
          fetchAll();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_applications',
        },
        (payload) => {
          const inserted = payload.new as any;
          // Notify task owner of new application
          if (inserted.applicant_profile_id !== profileId) {
            toast({ title: '📩 Nova candidatura recebida!', description: 'Um profissional se candidatou à sua tarefa.' });
          }
          fetchAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, toast]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("service_requests").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Tarefa removida" }); fetchAll(); }
  };

  const handleUpdateApplicationStatus = async (applicationId: string, newStatus: string) => {
    setUpdatingId(applicationId);
    const { error } = await supabase
      .from("task_applications")
      .update({ status: newStatus })
      .eq("id", applicationId);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Candidatura ${statusConfig[newStatus]?.label.toLowerCase() || newStatus}!` });

      // Send email notification via edge function
      const app = [...receivedApplications, ...myApplications].find(a => a.id === applicationId);
      if (app) {
        const taskOwnerProfileId = profileId;
        const applicantProfileId = app.applicant_profile_id;
        const taskDescription = app.service_request?.description || "Tarefa";

        supabase.functions.invoke("notify-task-application", {
          body: {
            application_id: applicationId,
            new_status: newStatus,
            applicant_profile_id: applicantProfileId,
            task_owner_profile_id: taskOwnerProfileId,
            task_description: taskDescription,
          },
        }).catch((err) => console.error("Email notification error:", err));
      }

      fetchAll();
    }
    setUpdatingId(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const pendingApps = myApplications.filter(a => a.status === "pending");
  const acceptedApps = myApplications.filter(a => a.status === "accepted");
  const completedApps = myApplications.filter(a => a.status === "completed");
  const rejectedApps = myApplications.filter(a => a.status === "rejected");

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="text-xs gap-1">
        <Icon className={`w-3 h-3 ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const renderApplicationCard = (app: TaskApplication, showActions: boolean = false) => {
    const req = app.service_request;
    if (!req) return null;
    return (
      <Card key={app.id} className="p-4 bg-card border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{req.service_categories?.name || "Categoria"}</Badge>
              {renderStatusBadge(app.status)}
              {!req.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Tarefa encerrada</Badge>}
            </div>
            <p className="text-sm text-foreground mt-1">{req.description}</p>
            {app.applicant && (
              <p className="text-xs text-primary font-medium mt-1">
                Candidato: {app.applicant.display_name}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{req.requester_name}</span>
              {req.budget && <span>R$ {req.budget}</span>}
              {req.city && <span>{req.city}/{req.state}</span>}
              <span>{new Date(app.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {app.conversation_id && (
              <Button variant="ghost" size="icon" className="text-primary" onClick={() => navigate(`/chat?conversation=${app.conversation_id}`)}>
                <MessageCircle className="w-4 h-4" />
              </Button>
            )}
            {showActions && app.status === "pending" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="text-xs gap-1"
                  disabled={updatingId === app.id}
                  onClick={() => handleUpdateApplicationStatus(app.id, "accepted")}
                >
                  {updatingId === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Aceitar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  disabled={updatingId === app.id}
                  onClick={() => handleUpdateApplicationStatus(app.id, "rejected")}
                >
                  <XCircle className="w-3 h-3" />
                  Rejeitar
                </Button>
              </>
            )}
            {showActions && app.status === "accepted" && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                disabled={updatingId === app.id}
                onClick={() => handleUpdateApplicationStatus(app.id, "completed")}
              >
                <CheckCircle className="w-3 h-3" />
                Concluir
              </Button>
            )}
            {!showActions && app.status === "accepted" && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                disabled={updatingId === app.id}
                onClick={() => handleUpdateApplicationStatus(app.id, "completed")}
              >
                <CheckCircle className="w-3 h-3" />
                Concluir
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderEmptyState = (message: string) => (
    <Card className="p-8 bg-card border-border text-center">
      <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Minhas Tarefas</h2>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas tarefas e acompanhe candidaturas</p>
        </div>
        <Button onClick={() => navigate("/buscar?mode=provider")} className="gap-2"><Plus className="w-4 h-4" /> Nova tarefa</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my-tasks" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="w-3.5 h-3.5" />
            Minhas Tarefas
            {demands.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{demands.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="my-applications" className="gap-1.5 text-xs sm:text-sm">
            <Send className="w-3.5 h-3.5" />
            Candidaturas
            {myApplications.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{myApplications.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="received" className="gap-1.5 text-xs sm:text-sm">
            <MessageCircle className="w-3.5 h-3.5" />
            Recebidas
            {receivedApplications.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{receivedApplications.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Tab: My Tasks */}
        <TabsContent value="my-tasks" className="space-y-3 mt-4">
          {demands.length === 0 ? (
            renderEmptyState("Nenhuma tarefa criada")
          ) : (
            demands.map((d) => (
              <Card key={d.id} className="p-4 bg-card border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">{d.service_categories?.name || "Categoria"}</Badge>
                      <Badge variant={d.is_active ? "default" : "outline"} className="text-xs">{d.is_active ? "Ativa" : "Inativa"}</Badge>
                    </div>
                    <p className="text-sm text-foreground">{d.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {d.budget && <span>Orçamento: R$ {d.budget}</span>}
                      {d.city && <span>{d.city}/{d.state}</span>}
                      <span>{new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(d.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tab: My Applications (as professional) */}
        <TabsContent value="my-applications" className="space-y-4 mt-4">
          {myApplications.length === 0 ? (
            renderEmptyState("Nenhuma candidatura enviada")
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3 text-yellow-600" /> Pendentes: {pendingApps.length}</Badge>
                <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Aceitas: {acceptedApps.length}</Badge>
                <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3 text-blue-600" /> Concluídas: {completedApps.length}</Badge>
                <Badge variant="secondary" className="gap-1"><XCircle className="w-3 h-3 text-red-500" /> Rejeitadas: {rejectedApps.length}</Badge>
              </div>
              <div className="space-y-3">
                {myApplications.map((app) => renderApplicationCard(app))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab: Received Applications (from other professionals) */}
        <TabsContent value="received" className="space-y-3 mt-4">
          {receivedApplications.length === 0 ? (
            renderEmptyState("Nenhuma candidatura recebida")
          ) : (
            <div className="space-y-3">
              {receivedApplications.map((app) => renderApplicationCard(app, true))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DemandsSection;
