import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import SearchFilters from "@/components/search/SearchFilters";
import ProviderCard from "@/components/search/ProviderCard";
import { Loader2 } from "lucide-react";

interface ProviderProfile {
  id: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  verification_status: string;
  created_at: string;
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

const SearchProviders = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewStats, setReviewStats] = useState<Map<string, { avg: number; count: number }>>(new Map());
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [profilesRes, servicesRes, categoriesRes, reviewsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, bio, city, state, avatar_url, verification_status, created_at")
          .eq("user_type", "provider")
          .eq("is_active", true),
        supabase
          .from("provider_services")
          .select("provider_id, category_id, hourly_rate, service_categories(name)"),
        supabase.from("service_categories").select("id, name, slug").order("name"),
        supabase.from("reviews").select("reviewed_id, rating"),
      ]);

      if (profilesRes.data) setProviders(profilesRes.data);
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

    // Filter by search query
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

    // Filter by category
    if (selectedCategory !== "all") {
      const providerIdsWithCategory = new Set(
        services.filter((s) => s.category_id === selectedCategory).map((s) => s.provider_id)
      );
      result = result.filter((p) => providerIdsWithCategory.has(p.id));
    }

    // Filter by city
    if (selectedCity !== "all") {
      result = result.filter((p) => p.city === selectedCity);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name") return a.display_name.localeCompare(b.display_name);
      if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "rating") {
        const ratingA = reviewStats.get(a.id)?.avg || 0;
        const ratingB = reviewStats.get(b.id)?.avg || 0;
        return ratingB - ratingA;
      }
      if (sortBy === "price_asc" || sortBy === "price_desc") {
        const getMinRate = (id: string) => {
          const rates = providerServices.get(id)?.map((s) => s.hourlyRate).filter((r): r is number => r !== null) || [];
          return rates.length ? Math.min(...rates) : Infinity;
        };
        const rateA = getMinRate(a.id);
        const rateB = getMinRate(b.id);
        return sortBy === "price_asc" ? rateA - rateB : rateB - rateA;
      }
      return 0;
    });

    return result;
  }, [providers, searchQuery, selectedCategory, selectedCity, sortBy, services, providerServices, reviewStats]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-6 pt-24 pb-16 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display">Encontrar Profissionais</h1>
          <p className="text-muted-foreground mt-1">
            {loading ? "Carregando..." : `${filtered.length} profissional(is) encontrado(s)`}
          </p>
        </div>

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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
