import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Radar as RadarIcon, Zap } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Props {
  count: number;
  urgent: boolean;
  onUrgentChange: (v: boolean) => void;
  radiusKm: number;
  expanding: boolean;
  loading?: boolean;
  categories: Category[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
  disabled?: boolean;
}

const RadarHeader = ({
  count,
  urgent,
  onUrgentChange,
  radiusKm,
  expanding,
  loading = false,
  categories,
  categoryId,
  onCategoryChange,
  disabled = false,
}: Props) => (
  <header className="space-y-3" data-testid="radar-header">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <RadarIcon className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight">Radar Ao Vivo</h1>
          <p className="text-xs text-muted-foreground" data-testid="radar-counter">
            {count > 0
              ? `${count} ${count === 1 ? "profissional disponível" : "profissionais disponíveis"} · raio ${radiusKm} km`
              : `Nenhum profissional no raio de ${radiusKm} km`}
          </p>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
        <Label
          htmlFor="radar-urgent"
          className="text-xs font-semibold cursor-pointer flex items-center gap-1"
          title="Modo Urgente"
        >
          <Zap className="w-3.5 h-3.5 text-red-500" />
          <span className="hidden sm:inline">Modo Urgente</span>
        </Label>
        <Switch id="radar-urgent" checked={urgent} onCheckedChange={onUrgentChange} disabled={disabled} />
      </div>
    </div>

    {urgent && (
      <Badge className="bg-red-600 text-white hover:bg-red-600" data-testid="radar-urgent-banner">
        <span className="sm:hidden">🔴 URGENTE</span>
        <span className="hidden sm:inline">🔴 URGENTE — PROFISSIONAIS DISPONÍVEIS</span>
      </Badge>
    )}

    {expanding && (
      <p className="text-xs text-muted-foreground" data-testid="radar-expanding">
        Expandindo o raio de busca para {radiusKm} km para encontrar mais profissionais…
      </p>
    )}

    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      <Button
        size="sm"
        variant={categoryId === "" ? "default" : "outline"}
        className="shrink-0 rounded-full h-8"
        onClick={() => onCategoryChange("")}
      >
        Todas
      </Button>
      {categories.map((c) => (
        <Button
          key={c.id}
          size="sm"
          variant={categoryId === c.id ? "default" : "outline"}
          className="shrink-0 rounded-full h-8"
          onClick={() => onCategoryChange(c.id)}
        >
          {c.name}
        </Button>
      ))}
    </div>
  </header>
);

export default RadarHeader;
