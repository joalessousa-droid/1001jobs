import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { MapPin, CheckCircle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecentProvider {
  id: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  verification_status: string;
  services: string[];
  minRate: number | null;
}

const RecentProviders = () => {
  const [providers, setProviders] = useState<RecentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchRecent = async () => {
      const [profilesRes, servicesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, bio, city, state, avatar_url, verification_status")
          .eq("user_type", "provider")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("provider_services")
          .select("provider_id, hourly_rate, service_categories(name)"),
      ]);

      if (profilesRes.data) {
        const serviceMap = new Map<string, { names: string[]; minRate: number | null }>();
        servicesRes.data?.forEach((s: any) => {
          const existing = serviceMap.get(s.provider_id) || { names: [], minRate: null };
          if (s.service_categories?.name) existing.names.push(s.service_categories.name);
          if (s.hourly_rate !== null) {
            existing.minRate = existing.minRate === null ? s.hourly_rate : Math.min(existing.minRate, s.hourly_rate);
          }
          serviceMap.set(s.provider_id, existing);
        });

        setProviders(
          profilesRes.data.map((p: any) => ({
            ...p,
            services: serviceMap.get(p.id)?.names || [],
            minRate: serviceMap.get(p.id)?.minRate ?? null,
          }))
        );
      }
      setLoading(false);
    };
    fetchRecent();
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    if (providers.length === 0 || isPaused) return;
    const el = scrollRef.current;
    if (!el) return;

    let animId: number;
    let scrollPos = el.scrollLeft;
    const speed = 0.5;

    const step = () => {
      scrollPos += speed;
      // Reset when reaching half (duplicated content)
      if (scrollPos >= el.scrollWidth / 2) {
        scrollPos = 0;
      }
      el.scrollLeft = scrollPos;
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [providers, isPaused]);

  if (loading || providers.length === 0) return null;

  // Duplicate for infinite scroll effect
  const displayProviders = [...providers, ...providers];

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 hero-glow opacity-30" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Profissionais <span className="text-gradient">Recentes</span>
            </h2>
            <p className="text-muted-foreground mt-2">Novos talentos disponíveis na plataforma</p>
          </div>
          <Link
            to="/search"
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
          {displayProviders.map((provider, i) => (
            <Link
              key={`${provider.id}-${i}`}
              to={`/provider/${provider.id}`}
              className="shrink-0 w-72 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group"
            >
              <div className="flex gap-3 items-start">
                <div className="h-12 w-12 shrink-0 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                  {provider.avatar_url ? (
                    <img src={provider.avatar_url} alt={provider.display_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground font-display">
                      {provider.display_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display font-bold text-foreground text-sm truncate">
                      {provider.display_name}
                    </h3>
                    {provider.verification_status === "verified" && (
                      <CheckCircle className="w-3.5 h-3.5 shrink-0 text-[hsl(var(--gold))]" />
                    )}
                  </div>
                  {(provider.city || provider.state) && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {[provider.city, provider.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {provider.bio && (
                <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{provider.bio}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-1">
                {provider.services.slice(0, 2).map((s, j) => (
                  <Badge key={j} variant="outline" className="text-[10px] border-border text-muted-foreground">
                    {s}
                  </Badge>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                {provider.minRate !== null ? (
                  <span className="text-xs font-semibold text-foreground">
                    R$ {provider.minRate}<span className="text-muted-foreground font-normal">/h</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sob consulta</span>
                )}
                <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver perfil →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <Link
          to="/search"
          className="sm:hidden flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline mt-6"
        >
          Ver todos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
};

export default RecentProviders;
