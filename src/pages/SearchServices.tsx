import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, CheckCircle, DollarSign, Search } from "lucide-react";

interface ServiceItem {
  id: string;
  description: string | null;
  hourly_rate: number | null;
  category_name: string;
  category_id: string;
  provider_id: string;
  provider_name: string;
  provider_city: string | null;
  provider_state: string | null;
  provider_avatar: string | null;
  provider_verified: string;
}

interface Category {
  id: string;
  name: string;
}

const SearchServices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "all");

  useEffect(() => {
    const fetchData = async () => {
      const [servicesRes, categoriesRes] = await Promise.all([
        supabase
          .from("provider_services")
          .select("id, description, hourly_rate, category_id, service_categories(name), provider_id, profiles!provider_services_provider_id_fkey(display_name, city, state, avatar_url, verification_status, is_active)")
          .order("created_at", { ascending: false }),
        supabase
          .from("service_categories")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);

      if (servicesRes.data) {
        setServices(
          servicesRes.data
            .filter((s: any) => s.profiles?.is_active !== false)
            .map((s: any) => ({
              id: s.id,
              description: s.description,
              hourly_rate: s.hourly_rate,
              category_name: s.service_categories?.name || "Serviço",
              category_id: s.category_id,
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
    fetchData();
  }, []);

  const filtered = services.filter((s) => {
    const matchesSearch =
      !searchTerm ||
      s.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.provider_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || s.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container px-6 max-w-6xl mx-auto">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            Buscar <span className="text-gradient">Serviços</span>
          </h1>
          <p className="text-muted-foreground mb-8">
            Encontre o serviço ideal entre os anúncios dos profissionais cadastrados
          </p>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar serviço, categoria ou profissional..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">Nenhum serviço encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((service) => (
                <Link
                  key={service.id}
                  to={`/provider/${service.provider_id}`}
                  className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group"
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
                    <p className="text-sm text-foreground line-clamp-3 font-medium">{service.description}</p>
                  )}

                  <div className="mt-4 flex gap-3 items-center">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
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
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {[service.provider_city, service.provider_state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    {service.hourly_rate !== null ? (
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                        R$ {service.hourly_rate}<span className="text-muted-foreground font-normal">/h</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sob consulta</span>
                    )}
                    <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver profissional →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SearchServices;
