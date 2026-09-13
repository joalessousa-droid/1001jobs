// Painel administrativo de tarefas com status e filtros por cidade e categoria.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Search, Trash2, EyeOff, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface AdminTaskRow {
  id: string;
  description: string;
  requester_name: string | null;
  category_id: string | null;
  category_name: string | null;
  city: string | null;
  state: string | null;
  budget: number | null;
  urgency: string | null;
  origin: string;
  status: string | null;
  computed_status: "aberta" | "agendada" | "concluida" | "expirada";
  is_synthetic: boolean;
  synthetic_expires_at: string | null;
  is_active: boolean;
  service_id: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  agendada: "Agendada",
  concluida: "Concluída",
  expirada: "Expirada",
};

const STATUS_CLASS: Record<string, string> = {
  aberta: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  agendada: "bg-primary/15 text-primary border-primary/30",
  concluida: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  expirada: "bg-muted text-muted-foreground",
};

const ALL = "__all__";

const AdminTasksPanel = () => {
  const [rows, setRows] = useState<AdminTaskRow[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [origin, setOrigin] = useState<string>(ALL);
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminTaskRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_tasks" as never, {
      _status: status === ALL ? null : status,
      _city: city || null,
      _category_id: categoryId === ALL ? null : categoryId,
      _origin: origin === ALL ? null : origin,
      _search: search || null,
      _limit: 200,
      _offset: 0,
    } as never);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar as tarefas.");
      return;
    }
    setRows((data ?? []) as unknown as AdminTaskRow[]);
  }, [status, city, categoryId, origin, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void supabase
      .from("service_categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as { id: string; name: string }[]));
  }, []);

  const counts = useMemo(() => {
    const base: Record<string, number> = { aberta: 0, agendada: 0, concluida: 0, expirada: 0 };
    rows.forEach((r) => { base[r.computed_status] = (base[r.computed_status] ?? 0) + 1; });
    return base;
  }, [rows]);

  const toggleActive = async (t: AdminTaskRow) => {
    const { error } = await supabase.rpc("admin_set_task_active" as never, {
      _task_id: t.id,
      _active: !t.is_active,
    } as never);
    if (error) {
      toast.error("Não foi possível alterar a tarefa.");
      return;
    }
    setRows((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: !t.is_active } : x)));
  };

  const remove = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.rpc("admin_delete_task" as never, { _task_id: confirmDelete.id } as never);
    setConfirmDelete(null);
    if (error) {
      toast.error("Não foi possível excluir a tarefa.");
      return;
    }
    toast.success("Tarefa excluída.");
    await load();
  };

  return (
    <div className="space-y-4" data-testid="admin-tasks-panel">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.keys(STATUS_LABEL).map((k) => (
          <Card key={k} className="p-3">
            <p className="text-xs text-muted-foreground">{STATUS_LABEL[k]}</p>
            <p className="text-xl font-semibold">{counts[k] ?? 0}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição ou solicitante"
            className="pl-9"
            data-testid="admin-tasks-search"
          />
        </div>
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="lg:w-44" data-testid="admin-tasks-city" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="lg:w-40" data-testid="admin-tasks-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {Object.keys(STATUS_LABEL).map((k) => (
              <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="lg:w-48" data-testid="admin-tasks-category"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger className="lg:w-36" data-testid="admin-tasks-origin"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as origens</SelectItem>
            <SelectItem value="standard">Convencional</SelectItem>
            <SelectItem value="radar">Radar</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-1.5" onClick={() => void load()} data-testid="admin-tasks-reload">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma tarefa encontrada com esses filtros.</Card>
      ) : (
        rows.map((t) => (
          <Card key={t.id} className="p-4" data-testid="admin-task-row">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[t.computed_status]}`}>
                    {STATUS_LABEL[t.computed_status]}
                  </Badge>
                  {t.origin === "radar" && <Badge variant="secondary" className="text-[10px]">Radar</Badge>}
                  {t.is_synthetic && <Badge variant="secondary" className="text-[10px]">Demo</Badge>}
                  <span className="text-xs text-muted-foreground">{t.category_name ?? "Sem categoria"}</span>
                </div>
                <p className="font-medium mt-1 line-clamp-2">{t.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {[t.city, t.state].filter(Boolean).join(", ") || "Sem localização"}
                  {" · "}
                  {format(new Date(t.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
                  {t.budget ? ` · R$ ${Number(t.budget).toFixed(2)}` : ""}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void toggleActive(t)} data-testid="admin-task-toggle">
                  {t.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {t.is_active ? "Ocultar" : "Reativar"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(t)} data-testid="admin-task-delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>A tarefa será removida definitivamente da plataforma.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTasksPanel;
