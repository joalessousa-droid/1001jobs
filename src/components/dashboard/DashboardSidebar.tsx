import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import {
  User, CreditCard, Shield, Eye, DollarSign, FileText,
  Briefcase, Star, GraduationCap, MessageCircle, LogOut, CalendarIcon, Sparkles, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardSection =
  | "profile"
  | "appointments"
  | "agenda"
  | "subscription"
  | "security"
  | "privacy"
  | "earnings"
  | "demands"
  | "recommendations"
  | "services"
  | "service-orders"
  | "reviews"
  | "education"
  | "contact";

interface Props {
  active: DashboardSection;
  onSelect: (s: DashboardSection) => void;
  userType: "client" | "provider";
}

const DashboardSidebar = ({ active, onSelect, userType }: Props) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const sections: { key: DashboardSection; label: string; icon: React.ElementType; providerOnly?: boolean }[] = [
    { key: "profile", label: t("dashboard.profile"), icon: User },
    { key: "appointments", label: t("dashboard.appointments"), icon: CalendarIcon },
    { key: "agenda", label: "Agenda & Ganhos", icon: CalendarDays, providerOnly: true },
    { key: "subscription", label: t("dashboard.subscription"), icon: CreditCard },
    { key: "earnings", label: t("dashboard.earnings"), icon: DollarSign, providerOnly: true },
    { key: "demands", label: t("dashboard.demands"), icon: FileText },
    { key: "service-orders", label: "Meus serviços", icon: ClipboardList },
    { key: "recommendations", label: "Recomendadas IA", icon: Sparkles, providerOnly: true },
    { key: "services", label: t("dashboard.services"), icon: Briefcase, providerOnly: true },
    { key: "reviews", label: t("dashboard.reviews"), icon: Star },
    { key: "security", label: t("dashboard.security"), icon: Shield },
    { key: "privacy", label: t("dashboard.privacy"), icon: Eye },
    { key: "education", label: t("dashboard.education"), icon: GraduationCap },
    { key: "contact", label: t("dashboard.contact"), icon: MessageCircle },
  ];

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
          {t("dashboard.signOut")}
        </Button>
      </div>
    </nav>
  );
};

export default DashboardSidebar;
