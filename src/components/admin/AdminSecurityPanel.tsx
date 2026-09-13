// Relatório de segurança: perfis públicos, tarefas sintéticas e expiradas.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReportProfile {
  id: string;
  display_name: string;
  user_type: string;
  city: string | null;
  state: string | null;
  is_synthetic: boolean;
  is_blocked: boolean;
  fraud_score: number;
  verification_status: string | null;
  created_at: string;
}

interface ReportTask {
  id: string;
  description: string;
  city: string | null;
  state: string | null;
  origin: string;
  synthetic_expires_at: string | null;
  created_at: string;
  is_active?: boolean;
  is_synthetic?: boolean;
}

interface SecurityReport {
  generated_at: string;
  totals: Record<string, number>;
  public_profiles: ReportProfile[];
  synthetic_tasks: ReportTask[];
  expired_tasks: ReportTask[];
}

const TOTAL_LABEL: Record<string, string> = {
  profiles: "Perfis totais",
  public_profiles: "Perfis públicos",
  synthetic_profiles: "Perfis de demonstração",
  blocked_profiles: "Perfis bloqueados",
  tasks: "Tarefas totais",
  synthetic_tasks: "Tarefas de demonstração",
  expired_tasks: "Tarefas expiradas",
  high_fraud_profiles: "Risco de fraude alto",
};

const AdminSecurityPanel = () => {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_security_report" as never);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível gerar o relatório.");
      return;
    }
    setReport(data as unknown as SecurityReport);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleBlock = async (p: ReportProfile) => {
    const { error } = await supabase.rpc("admin_set_profile_blocked" as never, {
      _profile_id: p.id,
      _blocked: !p.is_blocked,
      _reason: p.is_blocked ? null : "Bloqueado pelo relatório de segurança",
    } as never);
    if (error) {
      toast.error("Não foi possível alterar o bloqueio.");
      return;
    }
    toast.success(p.is_blocked ? "Perfil desbloqueado." : "Perfil bloqueado.");
    setReport((prev) =>
      prev
        ? {
            ...prev,
            public_profiles: prev.public_profiles.map((x) =>
              x.id === p.id ? { ...x, is_blocked: !p.is_blocked } : x,
            ),
          }
        : prev,
    );
  };

  const hideTask = async (t: ReportTask) => {
    const { error } = await supabase.rpc("admin_set_task_active" as never, { _task_id: t.id, _active: false } as never);
    if (error) {
      toast.error("Não foi possível bloquear a tarefa.");
      return;
    }
    toast.success("Tarefa bloqueada.");
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return <Card className="p-8 text-center text-muted-foreground">Relatório indisponível.</Card>;
  }

  const TaskList = ({ items }: { items: ReportTask[] }) => (
    <div className="space-y-3">
      {items.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nada por aqui.</Card>}
      {items.map((t) => (
        <Card key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="admin-security-task">
          <div className="min-w-0">
            <p className="font-medium line-clamp-2">{t.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {[t.city, t.state].filter(Boolean).join(", ") || "Sem localização"} · {t.origin}
              {t.synthetic_expires_at &&
                ` · expira ${format(new Date(t.synthetic_expires_at), "dd MMM yyyy", { locale: ptBR })}`}
            </p>
          </div>
          <Button size="sm" variant="destructive" className="gap-1.5 shrink-0" onClick={() => void hideTask(t)} data-testid="admin-security-block-task">
            <Trash2 className="w-3.5 h-3.5" /> Bloquear
          </Button>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="admin-security-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Gerado em {format(new Date(report.generated_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} data-testid="admin-security-reload">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(report.totals).map(([k, v]) => (
          <Card key={k} className="p-3">
            <p className="text-xs text-muted-foreground">{TOTAL_LABEL[k] ?? k}</p>
            <p className="text-xl font-semibold">{v}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Perfis públicos</TabsTrigger>
          <TabsTrigger value="synthetic">Tarefas de demonstração</TabsTrigger>
          <TabsTrigger value="expired">Tarefas expiradas</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-3 mt-5">
          {report.public_profiles.map((p) => (
            <Card key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="admin-security-profile">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{p.display_name}</p>
                  <Badge variant="outline" className="text-[10px]">{p.user_type === "provider" ? "Profissional" : "Cliente"}</Badge>
                  {p.is_synthetic && <Badge variant="secondary" className="text-[10px]">Demo</Badge>}
                  {p.is_blocked && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
                  {p.fraud_score >= 70 && <Badge variant="destructive" className="text-[10px]">Risco {p.fraud_score}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {[p.city, p.state].filter(Boolean).join(", ") || "Sem localização"} · desde{" "}
                  {format(new Date(p.created_at), "dd MMM yyyy", { locale: ptBR })}
                </p>
              </div>
              <Button
                size="sm"
                variant={p.is_blocked ? "outline" : "destructive"}
                className="gap-1.5 shrink-0"
                onClick={() => void toggleBlock(p)}
                data-testid="admin-security-block-profile"
              >
                {p.is_blocked ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                {p.is_blocked ? "Desbloquear" : "Bloquear"}
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="synthetic" className="mt-5">
          <TaskList items={report.synthetic_tasks} />
        </TabsContent>

        <TabsContent value="expired" className="mt-5">
          <TaskList items={report.expired_tasks} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSecurityPanel;
