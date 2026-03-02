import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight, DollarSign, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecentRequest {
  id: string;
  requester_name: string;
  requester_type: string;
  description: string;
  category_name: string;
  budget: number | null;
  city: string | null;
  state: string | null;
}

const RecentProviders = () => {
  const [requests, setRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchRecent = async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, requester_name, requester_type, description, budget, city, state, service_categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(15);

      if (data && !error) {
        setRequests(
          data.map((s: any) => ({
            id: s.id,
            requester_name: s.requester_name,
            requester_type: s.requester_type,
            description: s.description,
            category_name: s.service_categories?.name || "Serviço",
            budget: s.budget,
            city: s.city,
            state: s.state,
          }))
        );
      }
      setLoading(false);
    };
    fetchRecent();
  }, []);

  useEffect(() => {
    if (requests.length === 0 || isPaused) return;
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
  }, [requests, isPaused]);

  if (loading || requests.length === 0) return null;

  const displayItems = [...requests, ...requests];

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 hero-glow opacity-30" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Demandas <span className="text-gradient">Recentes</span>
            </h2>
            <p className="text-muted-foreground mt-2">Pessoas e empresas buscando profissionais agora</p>
          </div>
          <Link
            to="/servicos"
            className="hidden sm:flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Ver todas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div
          ref={scrollRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="flex gap-5 overflow-x-hidden"
          style={{ scrollBehavior: "auto" }}
        >
          {displayItems.map((req, i) => (
            <Link
              key={`${req.id}-${i}`}
              to={`/servicos`}
              className="shrink-0 w-80 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group"
            >
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {req.category_name}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  {req.requester_type === "company" ? <Building2 className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                  {req.requester_type === "company" ? "Empresa" : "Pessoa"}
                </Badge>
              </div>

              <p className="text-sm text-foreground line-clamp-2 font-medium">{req.description}</p>

              <div className="mt-3 flex gap-3 items-center">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-sm font-bold text-muted-foreground font-display">
                    {req.requester_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{req.requester_name}</p>
                  {(req.city || req.state) && (
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin className="w-2.5 h-2.5" />
                      {[req.city, req.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                {req.budget !== null ? (
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    R$ {req.budget}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">A combinar</span>
                )}
                <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver demanda →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <Link
          to="/servicos"
          className="sm:hidden flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline mt-6"
        >
          Ver todas <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
};

export default RecentProviders;
