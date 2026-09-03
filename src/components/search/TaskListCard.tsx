import { Clock, Users, MapPin, Building2, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TaskListCardProps {
  id: string;
  title: string;
  categoryName: string;
  requesterType: string;
  basePrice?: number | null;
  estimatedDurationLabel?: string;
  nearbyProvidersCount?: number;
  city: string | null;
  state: string | null;
  selected: boolean;
  onSelect: () => void;
  isSynthetic?: boolean;
}


const TaskListCard = ({
  title,
  categoryName,
  requesterType,
  basePrice,
  estimatedDurationLabel,
  nearbyProvidersCount,
  city,
  state,
  selected,
  onSelect,
  isSynthetic,
}: TaskListCardProps) => {

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "w-full text-left rounded-xl border bg-card p-4 transition-all cursor-pointer",
        "hover:border-primary/40 hover:shadow-md",
        selected ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
          {categoryName}
        </Badge>
        <Badge variant="outline" className="text-[10px] gap-1">
          {requesterType === "company" ? <Building2 className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
          {requesterType === "company" ? "Empresa" : "Pessoa"}
        </Badge>
        {isSynthetic && (
          <span title="Tarefa de demonstração" className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border uppercase tracking-wide">
            Demo
          </span>
        )}
      </div>


      <h3 className="font-semibold text-foreground line-clamp-2 text-sm">{title}</h3>

      <div className="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground">
        {(city || state) && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {[city, state].filter(Boolean).join(", ")}
          </span>
        )}
        {estimatedDurationLabel && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {estimatedDurationLabel}
          </span>
        )}
        {nearbyProvidersCount !== undefined && nearbyProvidersCount > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {nearbyProvidersCount} prof. próximos
          </span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        {basePrice != null ? (
          <div>
            <span className="text-xs text-muted-foreground">Orçamento </span>
            <span className="text-sm font-bold text-foreground">R$ {basePrice.toFixed(0)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">A combinar</span>
        )}
        <Button size="sm" variant={selected ? "default" : "outline"} className="text-xs h-8" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          {selected ? "Selecionado" : "Ver profissionais"}
        </Button>
      </div>
    </div>
  );
};

export default TaskListCard;
