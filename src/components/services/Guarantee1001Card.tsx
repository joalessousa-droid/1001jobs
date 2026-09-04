import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, Camera, Scale, LifeBuoy } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  serviceId?: string;
  className?: string;
}

/** #21 — 1001 Garantia: camada de proteção exibida em serviços ativos. */
const Guarantee1001Card = ({ serviceId, className }: Props) => {
  const items = [
    { icon: Lock, label: "Pagamento protegido — liberado ao profissional só após a conclusão" },
    { icon: Camera, label: "Evidências antes/depois registradas no serviço" },
    { icon: Scale, label: "Mediação da 1001Jobs em caso de divergência" },
    { icon: LifeBuoy, label: "Suporte dedicado durante todo o atendimento" },
  ];
  return (
    <Card className={`p-5 space-y-3 ${className ?? ""}`} data-testid="guarantee-1001">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        1001 Garantia
      </h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i.label} className="flex items-start gap-2">
            <i.icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>{i.label}</span>
          </li>
        ))}
      </ul>
      {serviceId && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={`/disputa/${serviceId}`}>Precisa de ajuda? Abrir suporte do serviço</Link>
        </Button>
      )}
    </Card>
  );
};

export default Guarantee1001Card;
