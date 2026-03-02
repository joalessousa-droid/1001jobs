import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { MapPin, CheckCircle, ArrowRight, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecentService {
  id: string;
  description: string | null;
  hourly_rate: number | null;
  category_name: string;
  provider_id: string;
  provider_name: string;
  provider_city: string | null;
  provider_state: string | null;
  provider_avatar: string | null;
  provider_verified: string;
}

const RecentProviders = () => {
  const [services, setServices] = useState<RecentService[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchRecent = async () => {
      const { data, error } = await supabase
        .from("provider_services")
        .select("id, description, hourly_rate, service_categories(name), provider_id, profiles!provider_services_provider_id_fkey(display_name, city, state, avatar_url, verification_status)")
        .order("created_at", { ascending: false })
        .limit(15);

      if (data && !error) {
        setServices(
          data.map((s: any) => ({
            id: s.id,
            description: s.description,
            hourly_rate: s.hourly_rate,
            category_name: s.service_categories?.name || "Serviço",
            provider_id: s.provider_id,
            provider_name: s.profiles?.display_name || "Profissional",
            provider_city: s.profiles?.city,
            provider_state: s.profiles?.state,
            provider_avatar: s.profiles?.avatar_url,
            provider_verified: s.profiles?.verification_status || "unverified",
          }))
        );
      }
      setLoading(false);
    };
    fetchRecent();
  }, []);

  useEffect(() => {
    if (services.length === 0 || isPaused) return;
    const el = scrollRef.current;
    if (!el) return;

    let animId: number;
    let scrollPos = el.scrollLeft;
    const speed = 0.5;

    const step = () => {
      scrollPos += speed;
      if (scrollPos >= el.scrollWidth / 2) scrollPos = 0;
      el.scrollLeft = scrollPos;
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [services, isPaused]);

  if (loading || services.length === 0) return null;

  const displayServices = [...services, ...services];

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 hero-glow opacity-30" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Serviços <span className="text-gradient">Recentes</span>
            </h2>
            <p className="text-muted-foreground mt-2">Novos serviços disponíveis na plataforma</p>
          </div>
          <Link
            to="/servicos"
            className="hidden sm:flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div
          ref={scrollRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="flex gap-5 overflow-x-hidden"
          style={{ scrollBehavior: "auto" }}
        >
          {displayServices.map((service, i) => (
            <Link
              key={`${service.id}-${i}`}
              to={`/provider/${service.provider_id}`}
              className="shrink-0 w-80 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group"
            >
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {service.category_name}
                </Badge>
                {service.provider_verified === "verified" && (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0 text-[hsl(var(--gold))]" />
                )}
              </div>

              {service.description && (
                <p className="text-sm text-foreground line-clamp-2 font-medium">{service.description}</p>
              )}

              <div className="mt-3 flex gap-3 items-center">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {service.provider_avatar ? (
                    <img src={service.provider_avatar} alt={service.provider_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground font-display">
                      {service.provider_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{service.provider_name}</p>
                  {(service.provider_city || service.provider_state) && (
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin className="w-2.5 h-2.5" />
                      {[service.provider_city, service.provider_state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                {service.hourly_rate !== null ? (
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    R$ {service.hourly_rate}<span className="text-muted-foreground font-normal">/h</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sob consulta</span>
                )}
                <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver detalhes →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <Link
          to="/servicos"
          className="sm:hidden flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline mt-6"
        >
          Ver todos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
};

export default RecentProviders;
