import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMatchScores, type MatchScore } from "@/hooks/useMatchScores";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MatchBadge from "@/components/search/MatchBadge";
import { Loader2, Sparkles, RefreshCw, MapPin, DollarSign, Send, Building2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Props {
  profileId: string;
}

interface RecommendedTask {
  id: string;
  description: string;
  budget: number | null;
  city: string | null;
  state: string | null;
  requester_name: string;
  requester_type: string;
  created_at: string;
  service_categories: { name: string } | null;
}

const RecommendationsSection = ({ profileId }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { scores, loading: matchLoading, fetchScoresForProfessional } = useMatchScores();
  const [tasks, setTasks] = useState<RecommendedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchAndScore = async () => {
    setLoading(true);
    try {
      // Fetch active tasks not owned by this user
      const { data: activeTasks } = await (supabase as any)
        .from("public_service_requests")
        .select("id, description, budget, city, state, requester_type, created_at, service_categories(name)")
        .neq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!activeTasks || activeTasks.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      setTasks(activeTasks as RecommendedTask[]);

      // Check already applied
      const { data: existingApps } = await supabase
        .from("task_applications")
        .select("service_request_id")
        .eq("applicant_profile_id", profileId)
        .in("service_request_id", activeTasks.map(t => t.id));

      setAppliedIds(new Set((existingApps || []).map((a: any) => a.service_request_id)));

      // Fetch AI match scores
      const taskIds = activeTasks.map(t => t.id);
      await fetchScoresForProfessional(profileId, taskIds);
    } catch (e) {
      console.error("Recommendations error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndScore();
  }, [profileId]);

  const handleApply = async (task: RecommendedTask) => {
    setApplyingId(task.id);
    try {
      // Find task owner profile
      const { data: taskData } = await supabase
        .from("service_requests")
        .select("profile_id")
        .eq("id", task.id)
        .single();

      if (!taskData?.profile_id) {
        toast({ title: "Erro", description: "Não foi possível encontrar o dono da tarefa.", variant: "destructive" });
        return;
      }

      // Create conversation
      const { data: convo, error: convoErr } = await supabase
        .from("conversations")
        .insert({ participant_1: profileId, participant_2: taskData.profile_id })
        .select("id")
        .single();

      if (convoErr) throw convoErr;

      // Send intro message
      await supabase.from("messages").insert({
        conversation_id: convo.id,
        sender_id: profileId,
        content: `Olá! Tenho interesse na sua tarefa: "${task.description.slice(0, 100)}". Podemos conversar sobre os detalhes?`,
      });

      // Create application
      await supabase.from("task_applications").insert({
        service_request_id: task.id,
        applicant_profile_id: profileId,
        conversation_id: convo.id,
      });

      setAppliedIds(prev => new Set([...prev, task.id]));
      toast({ title: "Candidatura enviada!", description: "Uma conversa foi iniciada com o solicitante." });

      // Notify via edge function
      supabase.functions.invoke("notify-task-application", {
        body: {
          application_id: "new",
          new_status: "pending",
          applicant_profile_id: profileId,
          task_owner_profile_id: taskData.profile_id,
          task_description: task.description,
        },
      }).catch(console.error);
    } catch (e: any) {
      if (e?.code === "23505") {
        toast({ title: "Você já se candidatou a esta tarefa." });
        setAppliedIds(prev => new Set([...prev, task.id]));
      } else {
        toast({ title: "Erro", description: e?.message || "Erro ao candidatar", variant: "destructive" });
      }
    } finally {
      setApplyingId(null);
    }
  };

  // Sort tasks by match score (descending)
  const sortedTasks = [...tasks].sort((a, b) => {
    const scoreA = scores.get(a.id)?.score ?? 0;
    const scoreB = scores.get(b.id)?.score ?? 0;
    return scoreB - scoreA;
  });

  if (loading || matchLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Tarefas Recomendadas
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Analisando compatibilidade com IA...</p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Tarefas Recomendadas
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Tarefas com maior compatibilidade com seu perfil, analisadas por IA
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAndScore} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {sortedTasks.length === 0 ? (
        <Card className="p-8 bg-card border-border text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma tarefa disponível no momento.</p>
          <Button variant="link" className="mt-2" onClick={() => navigate("/buscar?mode=provider")}>
            Explorar todas as tarefas →
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => {
            const match = scores.get(task.id);
            const applied = appliedIds.has(task.id);
            const TypeIcon = task.requester_type === "company" ? Building2 : User;

            return (
              <Card key={task.id} className="p-4 bg-card border-border hover:border-primary/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {task.service_categories?.name || "Categoria"}
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <TypeIcon className="w-3 h-3" />
                        {task.requester_type === "company" ? "Empresa" : "Pessoa"}
                      </Badge>
                      {match && match.score > 0 && (
                        <MatchBadge score={match.score} reasons={match.reasons} />
                      )}
                    </div>
                    <p className="text-sm text-foreground">{task.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>{task.requester_name}</span>
                      {task.budget && (
                        <span className="flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />
                          R$ {task.budget}
                        </span>
                      )}
                      {task.city && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {task.city}{task.state ? `/${task.state}` : ""}
                        </span>
                      )}
                    </div>
                    {match?.reasons && match.reasons.length > 0 && (
                      <p className="text-xs text-muted-foreground/70 mt-1.5 italic">
                        {match.reasons.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {applied ? (
                      <Badge variant="outline" className="text-xs text-primary border-primary/30">
                        Candidatado ✓
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleApply(task)}
                        disabled={applyingId === task.id}
                      >
                        {applyingId === task.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Me candidatar
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          <div className="text-center pt-2">
            <Button variant="link" onClick={() => navigate("/buscar?mode=provider")}>
              Ver todas as tarefas →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsSection;
