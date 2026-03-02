import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import SearchFilters from "@/components/search/SearchFilters";
import ProviderCard from "@/components/search/ProviderCard";
import SearchMap, { type MapMarker } from "@/components/search/SearchMap";
import { Loader2, MapIcon, List, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "list" | "map";
type UserMode = "client" | "provider";

interface ProviderProfile {
  id: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  verification_status: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
}

interface ProviderService {
  provider_id: string;
  category_id: string;
  hourly_rate: number | null;
  category_name: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SearchProviders = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewStats, setReviewStats] = useState<Map<string, { avg: number; count: number }>>(new Map());
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [userMode, setUserMode] = useState<UserMode>("client");
  const [radius, setRadius] = useState(25);
  const [showAll, setShowAll] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number]>([-14.235, -51.9253]); // Brasil center default
  const [locating, setLocating] = useState(false);

  const searchQuery = searchParams.get("q") || "";
  const selectedCategory = searchParams.get("category") || "all";
  const selectedCity = searchParams.get("city") || "all";
  const sortBy = searchParams.get("sort") || "name";

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "" || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params, { replace: true });
  };

  const requestLocation = useCallback(async () => {
    setLocating(true);

    // Try IP-based geolocation first (no permission needed)
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      if (data.latitude && data.longitude) {
        setUserLocation([data.latitude, data.longitude]);
        setShowAll(false);
        setLocating(false);
        toast({ title: "Localização detectada via IP!", description: `${data.city || ""}, ${data.region || ""}` });
        return;
      }
    } catch {}

    // Fallback to browser geolocation
    if (!navigator.geolocation) {
      setLocating(false);
      toast({ title: "Não foi possível obter localização", variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setShowAll(false);
        setLocating(false);
        toast({ title: "Localização atualizada via GPS!" });
      },
      () => {
        setLocating(false);
        toast({ title: "Não foi possível obter localização", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [toast]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [profilesRes, servicesRes, categoriesRes, reviewsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, bio, city, state, avatar_url, verification_status, created_at, latitude, longitude")
          .eq("user_type", "provider")
          .eq("is_active", true),
        supabase
          .from("provider_services")
          .select("provider_id, category_id, hourly_rate, service_categories(name)"),
        supabase.from("service_categories").select("id, name, slug").order("name"),
        supabase.from("reviews").select("reviewed_id, rating"),
      ]);

      if (profilesRes.data) setProviders(profilesRes.data as ProviderProfile[]);
      if (servicesRes.data) {
        setServices(
          servicesRes.data.map((s: any) => ({
            provider_id: s.provider_id,
            category_id: s.category_id,
            hourly_rate: s.hourly_rate,
            category_name: s.service_categories?.name || "",
          }))
        );
      }
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (reviewsRes.data) {
        const statsMap = new Map<string, { sum: number; count: number }>();
        reviewsRes.data.forEach((r: any) => {
          const existing = statsMap.get(r.reviewed_id) || { sum: 0, count: 0 };
          existing.sum += r.rating;
          existing.count += 1;
          statsMap.set(r.reviewed_id, existing);
        });
        const avgMap = new Map<string, { avg: number; count: number }>();
        statsMap.forEach((v, k) => avgMap.set(k, { avg: v.sum / v.count, count: v.count }));
        setReviewStats(avgMap);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const cities = useMemo(() => {
    const uniqueCities = [...new Set(providers.map((p) => p.city).filter(Boolean))] as string[];
    return uniqueCities.sort();
  }, [providers]);

  const providerServices = useMemo(() => {
    const map = new Map<string, { categoryName: string; hourlyRate: number | null }[]>();
    services.forEach((s) => {
      if (!map.has(s.provider_id)) map.set(s.provider_id, []);
      map.get(s.provider_id)!.push({ categoryName: s.category_name, hourlyRate: s.hourly_rate });
    });
    return map;
  }, [services]);

  const filtered = useMemo(() => {
    let result = [...providers];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const nameMatch = p.display_name.toLowerCase().includes(q);
        const bioMatch = p.bio?.toLowerCase().includes(q);
        const serviceMatch = providerServices
          .get(p.id)
          ?.some((s) => s.categoryName.toLowerCase().includes(q));
        return nameMatch || bioMatch || serviceMatch;
      });
    }

    if (selectedCategory !== "all") {
      const providerIdsWithCategory = new Set(
        services.filter((s) => s.category_id === selectedCategory).map((s) => s.provider_id)
      );
      result = result.filter((p) => providerIdsWithCategory.has(p.id));
    }

    if (selectedCity !== "all") {
      result = result.filter((p) => p.city === selectedCity);
    }

    // Filter by radius when in map view (unless showAll is enabled)
    if (viewMode === "map" && !showAll) {
      result = result.filter((p) => {
        if (p.latitude == null || p.longitude == null) return false;
        const dist = getDistanceKm(userLocation[0], userLocation[1], p.latitude, p.longitude);
        return dist <= radius;
      });
    } else if (viewMode === "map") {
      result = result.filter((p) => p.latitude != null && p.longitude != null);
    }

    result.sort((a, b) => {
      if (sortBy === "name") return a.display_name.localeCompare(b.display_name);
      if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "rating") {
        return (reviewStats.get(b.id)?.avg || 0) - (reviewStats.get(a.id)?.avg || 0);
      }
      if (sortBy === "price_asc" || sortBy === "price_desc") {
        const getMinRate = (id: string) => {
          const rates = providerServices.get(id)?.map((s) => s.hourlyRate).filter((r): r is number => r !== null) || [];
          return rates.length ? Math.min(...rates) : Infinity;
        };
        return sortBy === "price_asc" ? getMinRate(a.id) - getMinRate(b.id) : getMinRate(b.id) - getMinRate(a.id);
      }
      if (sortBy === "distance") {
        const distA = a.latitude != null ? getDistanceKm(userLocation[0], userLocation[1], a.latitude, a.longitude!) : Infinity;
        const distB = b.latitude != null ? getDistanceKm(userLocation[0], userLocation[1], b.latitude, b.longitude!) : Infinity;
        return distA - distB;
      }
      return 0;
    });

    return result;
  }, [providers, searchQuery, selectedCategory, selectedCity, sortBy, services, providerServices, reviewStats, viewMode, radius, userLocation, showAll]);

  const mapMarkers: MapMarker[] = useMemo(() => {
    if (userMode === "client") {
      return filtered
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          id: p.id,
          lat: p.latitude!,
          lng: p.longitude!,
          name: p.display_name,
          subtitle: providerServices.get(p.id)?.[0]?.categoryName || p.city || "",
          type: "provider" as const,
        }));
    } else {
      // Provider mode: show other providers
      return filtered
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          id: p.id,
          lat: p.latitude!,
          lng: p.longitude!,
          name: p.display_name,
          subtitle: providerServices.get(p.id)?.[0]?.categoryName || p.city || "",
          type: "provider" as const,
        }));
    }
  }, [filtered, userMode, providerServices]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-6 pt-24 pb-16 max-w-6xl mx-auto">
        {/* Header with mode toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold font-display">Encontrar Profissionais</h1>
            <p className="text-muted-foreground mt-1">
              {loading ? "Carregando..." : `${filtered.length} profissional(is) encontrado(s)`}
            </p>
          </div>

          {/* User mode toggle */}
          <div className="flex items-center gap-2 bg-secondary rounded-xl p-1">
            <button
              onClick={() => setUserMode("client")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                userMode === "client"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sou Cliente
            </button>
            <button
              onClick={() => setUserMode("provider")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                userMode === "provider"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sou Profissional
            </button>
          </div>
        </div>

        {/* Description based on mode */}
        <p className="text-sm text-muted-foreground mb-6 bg-card border border-border rounded-xl px-4 py-3">
          {userMode === "client"
            ? "🔍 Encontre profissionais próximos a você. Use o mapa para visualizar a localização e o raio de busca."
            : "📊 Veja outros profissionais atuando na sua região. Analise a concorrência e identifique oportunidades."}
        </p>

        <SearchFilters
          searchQuery={searchQuery}
          onSearchChange={(v) => updateParam("q", v)}
          selectedCategory={selectedCategory}
          onCategoryChange={(v) => updateParam("category", v)}
          selectedCity={selectedCity}
          onCityChange={(v) => updateParam("city", v)}
          sortBy={sortBy}
          onSortChange={(v) => updateParam("sort", v)}
          categories={categories}
          cities={cities}
        />

        {/* View toggle + Location + Radius */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="flex bg-secondary rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-all ${
                  viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Lista"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`p-2 rounded-md transition-all ${
                  viewMode === "map" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Mapa"
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>

            {viewMode === "map" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestLocation}
                  disabled={locating}
                  className="gap-1.5 text-xs"
                >
                  <LocateFixed className={`w-3.5 h-3.5 ${locating ? "animate-spin" : ""}`} />
                  {locating ? "Localizando..." : "Minha localização"}
                </Button>
                <Button
                  variant={showAll ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="gap-1.5 text-xs"
                >
                  {showAll ? "✓ Ver todos" : "Ver todos"}
                </Button>
              </>
            )}
          </div>

          {viewMode === "map" && !showAll && (
            <div className="flex items-center gap-3 flex-1 max-w-xs">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Raio:</span>
              <Slider
                value={[radius]}
                onValueChange={(v) => setRadius(v[0])}
                min={5}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-xs font-medium text-foreground whitespace-nowrap w-12 text-right">
                {radius} km
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : viewMode === "map" ? (
          <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-4">
            <SearchMap
              markers={mapMarkers}
              center={userLocation}
              radius={showAll ? 0 : radius}
              onMarkerClick={(id) => navigate(`/provider/${id}`)}
              className="h-[500px] lg:h-[600px] rounded-xl border border-border overflow-hidden"
            />
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground font-medium px-1">
                {filtered.length} resultado(s) em {radius}km
              </p>
              {filtered.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  id={provider.id}
                  displayName={provider.display_name}
                  bio={provider.bio}
                  city={provider.city}
                  state={provider.state}
                  avatarUrl={provider.avatar_url}
                  verificationStatus={provider.verification_status}
                  services={providerServices.get(provider.id) || []}
                  avgRating={reviewStats.get(provider.id)?.avg}
                  reviewCount={reviewStats.get(provider.id)?.count}
                />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Nenhum profissional neste raio</p>
                  <p className="text-xs text-muted-foreground mt-1">Tente aumentar o raio de busca</p>
                </div>
              )}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg font-medium text-foreground">Nenhum profissional encontrado</p>
            <p className="text-muted-foreground mt-1">Tente ajustar seus filtros</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            {filtered.map((provider) => (
              <ProviderCard
                key={provider.id}
                id={provider.id}
                displayName={provider.display_name}
                bio={provider.bio}
                city={provider.city}
                state={provider.state}
                avatarUrl={provider.avatar_url}
                verificationStatus={provider.verification_status}
                services={providerServices.get(provider.id) || []}
                avgRating={reviewStats.get(provider.id)?.avg}
                reviewCount={reviewStats.get(provider.id)?.count}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchProviders;
