import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EnhancedReviewList from "@/components/reviews/EnhancedReviewList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  MapPin, Phone, CheckCircle, Clock, ArrowLeft, Briefcase, Image as ImageIcon, MessageSquare,
} from "lucide-react";
import AppointmentBooking from "@/components/scheduling/AppointmentBooking";
import ShareButton from "@/components/search/ShareButton";

interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  verification_status: string;
  is_active: boolean;
}

interface Service {
  id: string;
  description: string | null;
  hourly_rate: number | null;
  category: { name: string; icon: string | null };
}

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

const ProviderProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"services" | "portfolio" | "reviews">("services");

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [profileRes, servicesRes, portfolioRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).eq("user_type", "provider").single(),
        supabase.from("provider_services").select("id, description, hourly_rate, service_categories(name, icon)").eq("provider_id", id),
        supabase.from("portfolio_items").select("*").eq("provider_id", id).order("created_at", { ascending: false }),
      ]);
      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (servicesRes.data) {
        setServices(servicesRes.data.map((s: any) => ({
          id: s.id, description: s.description, hourly_rate: s.hourly_rate,
          category: s.service_categories || { name: "Serviço", icon: null },
        })));
      }
      if (portfolioRes.data) setPortfolio(portfolioRes.data);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-4xl mx-auto px-6 py-12">
          <Skeleton className="h-32 w-full rounded-2xl mb-6" />
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-20 w-full" />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-4">{t("providerProfile.notFound")}</h1>
          <p className="text-muted-foreground mb-6">{t("providerProfile.notFoundDesc")}</p>
          <Button asChild variant="outline">
            <Link to="/buscar"><ArrowLeft className="w-4 h-4 mr-2" />{t("providerProfile.backToSearch")}</Link>
          </Button>
        </main>
      </div>
    );
  }

  const verificationBadge = {
    verified: { label: t("providerProfile.verified"), icon: CheckCircle, className: "bg-[hsl(45,93%,47%)]/15 text-[hsl(45,93%,47%)] border-[hsl(45,93%,47%)]/30 border" },
    pending: { label: t("providerProfile.pending"), icon: Clock, className: "bg-secondary text-secondary-foreground" },
    unverified: { label: t("providerProfile.unverified"), icon: Clock, className: "bg-secondary/50 text-muted-foreground border border-border" },
  }[profile.verification_status] || { label: t("providerProfile.unverified"), icon: Clock, className: "bg-secondary/50 text-muted-foreground border border-border" };

  const tabs = [
    { key: "services" as const, label: t("providerProfile.services"), count: services.length },
    { key: "portfolio" as const, label: t("providerProfile.portfolio"), count: portfolio.length },
    { key: "reviews" as const, label: t("providerProfile.reviews") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 hero-glow opacity-40" />
        <div className="max-w-4xl mx-auto px-6 pt-28 pb-10 relative z-10">
          <Link to="/buscar" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t("providerProfile.backToSearch")}
          </Link>

          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar className="h-24 w-24 rounded-2xl border-2 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name} />
              <AvatarFallback className="text-2xl font-display font-bold bg-primary/10 text-primary rounded-2xl">
                {profile.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-3xl font-display font-bold text-foreground">{profile.display_name}</h1>
                {profile.verification_status === "verified" ? (
                  <CheckCircle className="w-6 h-6 text-primary fill-primary/20" />
                ) : (
                  <Badge className={`gap-1.5 ${verificationBadge.className}`}>
                    <verificationBadge.icon className="w-3 h-3" />
                    {verificationBadge.label}
                  </Badge>
                )}
              </div>

              {(profile.city || profile.state) && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                  <MapPin className="w-4 h-4" />
                  {[profile.city, profile.state].filter(Boolean).join(", ")}
                </p>
              )}

              {profile.phone && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                  <Phone className="w-4 h-4" />
                  {profile.phone}
                </p>
              )}

              {profile.bio && (
                <p className="text-sm text-secondary-foreground leading-relaxed max-w-2xl">{profile.bio}</p>
              )}

              <div className="flex gap-2 mt-4 flex-wrap items-center">
                <Button onClick={() => navigate(`/chat?with=${profile.id}`)} className="gap-2 rounded-xl">
                  <MessageSquare className="w-4 h-4" />
                  {t("providerProfile.sendMessage")}
                </Button>
                <AppointmentBooking
                  providerId={profile.id}
                  providerName={profile.display_name}
                  services={services.map((s) => ({ id: s.id, name: s.category.name }))}
                />
                <ShareButton
                  url={`/provider/${profile.id}`}
                  title={profile.display_name}
                  text={`Confira o perfil de ${profile.display_name}${profile.bio ? ` - ${profile.bio.slice(0, 100)}` : ""}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-20">
        <div className="max-w-4xl mx-auto px-6 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>}
              {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === "services" && (
          <div className="space-y-4">
            {services.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground">{t("providerProfile.noServices")}</p>
              </div>
            ) : (
              services.map((service) => (
                <div key={service.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{service.category.name}</h3>
                      {service.description && <p className="text-sm text-muted-foreground mt-1">{service.description}</p>}
                    </div>
                    {service.hourly_rate && (
                      <div className="text-right shrink-0">
                        <span className="text-lg font-display font-bold text-primary">R${service.hourly_rate}</span>
                        <span className="text-xs text-muted-foreground block">{t("providerProfile.perHour")}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "portfolio" && (
          <div>
            {portfolio.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground">{t("providerProfile.noPortfolio")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {portfolio.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-card overflow-hidden group hover:border-primary/20 transition-colors">
                    {item.image_url ? (
                      <div className="aspect-[4/3] overflow-hidden">
                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-medium text-sm text-foreground truncate">{item.title}</h4>
                      {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && id && <EnhancedReviewList profileId={id} showReputation={true} />}
      </main>

      <Footer />
    </div>
  );
};

export default ProviderProfile;
