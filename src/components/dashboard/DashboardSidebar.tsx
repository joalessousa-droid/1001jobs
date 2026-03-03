import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  User, CreditCard, Shield, Eye, DollarSign, FileText,
  Briefcase, Star, GraduationCap, MessageCircle, LogOut, CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardSection =
  | "profile"
  | "appointments"
  | "subscription"
  | "security"
  | "privacy"
  | "earnings"
  | "demands"
  | "services"
  | "reviews"
  | "education"
  | "contact";

interface Props {
  active: DashboardSection;
  onSelect: (s: DashboardSection) => void;
  userType: "client" | "provider";
}

const sections: { key: DashboardSection; label: string; icon: React.ElementType; providerOnly?: boolean }[] = [
  { key: "profile", label: "Meu Perfil", icon: User },
  { key: "appointments", label: "Agendamentos", icon: CalendarIcon },
  { key: "subscription", label: "Assinatura", icon: CreditCard },
  { key: "earnings", label: "Ganhos", icon: DollarSign, providerOnly: true },
  { key: "demands", label: "Demandas", icon: FileText },
  { key: "services", label: "Serviços", icon: Briefcase, providerOnly: true },
  { key: "reviews", label: "Avaliações", icon: Star },
  { key: "security", label: "Segurança", icon: Shield },
  { key: "privacy", label: "Privacidade", icon: Eye },
  { key: "education", label: "Educação", icon: GraduationCap },
  { key: "contact", label: "Fale Conosco", icon: MessageCircle },
];

const DashboardSidebar = ({ active, onSelect, userType }: Props) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const filtered = sections.filter((s) => !s.providerOnly || userType === "provider");

  return (
    <nav className="w-full lg:w-64 shrink-0">
      <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
        {filtered.map((s) => (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
              active === s.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <s.icon className="w-4 h-4 shrink-0" />
            {s.label}
          </button>
        ))}
        <div className="border-t border-border my-2" />
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
    </nav>
  );
};

export default DashboardSidebar;
