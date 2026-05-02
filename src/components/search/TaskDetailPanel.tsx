import { Building2, User as UserIcon, MapPin, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ShareButton from "@/components/search/ShareButton";

interface TaskDetailPanelProps {
  id: string;
  requesterName: string;
  requesterType: string;
  description: string;
  budget: number | null;
  city: string | null;
  state: string | null;
  categoryName: string;
  applied: boolean;
  applying: boolean;
  onApply: () => void;
  onGoChat: () => void;
}

const TaskDetailPanel = (props: TaskDetailPanelProps) => {
  const { id, requesterName, requesterType, description, budget, city, state, categoryName, applied, applying, onApply, onGoChat } = props;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 shrink-0 rounded-xl bg-muted flex items-center justify-center">
            <span className="text-2xl font-bold text-muted-foreground font-display">
              {requesterName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-display font-bold text-foreground truncate">{categoryName}</h2>
              <ShareButton url={`/buscar?task=${id}`} title={categoryName} text={`Tarefa: ${description.slice(0, 100)}`} />
            </div>
            <p className="text-sm text-foreground mt-0.5">{requesterName}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] gap-1">
                {requesterType === "company" ? <Building2 className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                {requesterType === "company" ? "Empresa" : "Pessoa"}
              </Badge>
              {(city || state) && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[city, state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Orçamento</p>
          <p className="text-2xl font-bold text-foreground">
            {budget != null ? `R$ ${budget.toFixed(0)}` : "A combinar"}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Descrição da tarefa</h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{description}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">O que está incluso</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Conversa direta com o solicitante via chat</li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Pagamento seguro com retenção (escrow)</li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Avaliação bidirecional após conclusão</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Próximos passos</h3>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Envie sua candidatura</li>
            <li>Combine detalhes no chat</li>
            <li>Confirme valor e prazo</li>
            <li>Execute e receba o pagamento</li>
          </ol>
        </div>
      </div>

      <div className="border-t border-border p-4 bg-card">
        {applied ? (
          <Button variant="secondary" className="w-full gap-2" onClick={onGoChat}>
            <Send className="w-4 h-4" />
            Candidatado ✓ — Abrir chat
          </Button>
        ) : (
          <Button className="w-full gap-2" disabled={applying} onClick={onApply}>
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Continuar e me candidatar
          </Button>
        )}
      </div>
    </div>
  );
};

export default TaskDetailPanel;
