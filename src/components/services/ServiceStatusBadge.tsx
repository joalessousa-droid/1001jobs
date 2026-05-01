import { Badge } from "@/components/ui/badge";
import type { ServiceStatus } from "@/hooks/useServices";
import { Clock, CheckCircle2, PlayCircle, Flag, ThumbsUp, XCircle, AlertTriangle, RotateCcw } from "lucide-react";

export const STATUS_META: Record<ServiceStatus, { label: string; className: string; Icon: any }> = {
  pending: { label: "Aguardando aceite", className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30", Icon: Clock },
  accepted: { label: "Aceito", className: "bg-blue-500/15 text-blue-500 border-blue-500/30", Icon: CheckCircle2 },
  in_progress: { label: "Em andamento", className: "bg-primary/15 text-primary border-primary/30", Icon: PlayCircle },
  completed: { label: "Aguardando confirmação", className: "bg-orange-500/15 text-orange-500 border-orange-500/30", Icon: Flag },
  confirmed: { label: "Confirmado", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", Icon: ThumbsUp },
  cancelled_by_client: { label: "Cancelado pelo cliente", className: "bg-muted text-muted-foreground", Icon: XCircle },
  cancelled_by_provider: { label: "Cancelado pelo profissional", className: "bg-muted text-muted-foreground", Icon: XCircle },
  disputed: { label: "Em disputa", className: "bg-red-500/15 text-red-500 border-red-500/30", Icon: AlertTriangle },
  refunded: { label: "Reembolsado", className: "bg-purple-500/15 text-purple-500 border-purple-500/30", Icon: RotateCcw },
};

const ServiceStatusBadge = ({ status }: { status: ServiceStatus }) => {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <Badge variant="outline" className={`${meta.className} gap-1.5 font-medium`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
  );
};

export default ServiceStatusBadge;
