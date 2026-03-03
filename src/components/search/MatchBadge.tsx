import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MatchBadgeProps {
  score: number;
  reasons?: string[];
}

const MatchBadge = ({ score, reasons }: MatchBadgeProps) => {
  if (score <= 0) return null;

  const getColor = (s: number) => {
    if (s >= 85) return "text-green-500 bg-green-500/10 border-green-500/30";
    if (s >= 60) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
    return "text-muted-foreground bg-muted border-border";
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${getColor(score)} cursor-default`}
        >
          <Sparkles className="w-3 h-3" />
          {score}%
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        <p className="font-semibold text-xs mb-1">Compatibilidade IA</p>
        {reasons && reasons.length > 0 ? (
          <ul className="text-xs space-y-0.5">
            {reasons.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Score baseado em categoria, localização e perfil</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export default MatchBadge;
