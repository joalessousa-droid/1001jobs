import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FlaskConical, RotateCcw } from "lucide-react";
import { SANDBOX_SCENARIOS, type SandboxScenario } from "@/hooks/useRadarSandbox";

interface Props {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  scenario: SandboxScenario;
  onScenarioChange: (v: SandboxScenario) => void;
  available: number;
  busy: number;
  onReset: () => void;
  disabled?: boolean;
}

const RadarTestModePanel = ({
  enabled,
  onEnabledChange,
  scenario,
  onScenarioChange,
  available,
  busy,
  onReset,
  disabled,
}: Props) => {
  const def = SANDBOX_SCENARIOS.find((s) => s.id === scenario) ?? SANDBOX_SCENARIOS[0];

  return (
    <Card className="p-4 space-y-3 border-dashed" data-testid="radar-test-mode">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4 text-primary" /> Modo de teste
          </p>
          <p className="text-xs text-muted-foreground">
            Perfis bot locais — nenhuma solicitação ou dado real é criado.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} disabled={disabled} />
      </div>

      {enabled && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Cenário
            </Label>
            <Select value={scenario} onValueChange={(v) => onScenarioChange(v as SandboxScenario)}>
              <SelectTrigger data-testid="radar-test-scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[1200]">
                {SANDBOX_SCENARIOS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{def.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {def.range[0]}–{def.range[1]} km
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {available} disponíveis
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {busy} ocupados
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              resposta ~{Math.round(def.replyDelayMs / 1000)}s
            </Badge>
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={onReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reiniciar
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default RadarTestModePanel;
