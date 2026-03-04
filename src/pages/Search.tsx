import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchFilters from "@/components/search/SearchFilters";
import ProviderCard from "@/components/search/ProviderCard";
import SearchMap, { type MapMarker } from "@/components/search/SearchMap";
import CreateServiceRequest from "@/components/search/CreateServiceRequest";
import MatchBadge from "@/components/search/MatchBadge";
import { Loader2, MapIcon, List, LocateFixed, MapPin, DollarSign, Building2, User, Send, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMatchScores } from "@/hooks/useMatchScores";

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

interface ServiceRequest {
  id: string;
  requester_name: string;
  requester_type: string;
  description: string;
  budget: number | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  category_name: string;
  category_id: string;
  profile_id: string | null;
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

const ServiceRequestCard = ({
  req,
  onApply,
  applying,
  applied,
  onGoChat,
  matchScore,
  matchReasons,
}: {
  req: ServiceRequest;
  onApply?: (req: ServiceRequest) => void;
  applying?: boolean;
  applied?: boolean;
  onGoChat?: () => void;
  matchScore?: number;
  matchReasons?: string[];
}) => (
  <div className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group">
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
        {req.category_name}
      </Badge>
      <Badge variant="outline" className="text-[10px] gap-1">
        {req.requester_type === "company" ? <Building2 className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
        {req.requester_type === "company" ? "Empresa" : "Pessoa"}
      </Badge>
      {matchScore !== undefined && matchScore > 0 && (
        <MatchBadge score={matchScore} reasons={matchReasons} />
      )}
    </div>
    <p className="text-sm text-foreground line-clamp-3 font-medium">{req.description}</p>
    <div className="mt-4 flex gap-3 items-center">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-muted flex items-center justify-center">
        <span className="text-sm font-bold text-muted-foreground font-display">
          {req.requester_name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground truncate">{req.requester_name}</p>
        {(req.city || req.state) && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {[req.city, req.state].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
      {req.budget !== null ? (
        <span className="text-sm font-semibold text-foreground flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5 text-primary" />
          R$ {req.budget}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">A combinar</span>
      )}
      {applied ? (
        <Button size="sm" variant="secondary" className="gap-1.5 text-xs" onClick={onGoChat}>
          <Send className="w-3.5 h-3.5" />
          Candidatado ✓
        </Button>
      ) : onApply ? (
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => onApply(req)} disabled={applying}>
          {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Me candidatar
        </Button>
      ) : null}
    </div>
  </div>
);

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewStats, setReviewStats] = useState<Map<string, { avg: number; count: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const { scores: matchScores, loading: matchLoading, fetchScoresForTask, fetchScoresForProfessional } = useMatchScores();
  const [matchActive, setMatchActive] = useState(false);
  const [autoMatchTriggered, setAutoMatchTriggered] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [userMode, setUserMode] = useState<UserMode>((searchParams.get("mode") as UserMode) || "client");
  const [radius, setRadius] = useState(25);
  const [showAll, setShowAll] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number]>([-14.235, -51.9253]);
  const [locating, setLocating] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profilesRes, servicesRes, categoriesRes, reviewsRes, requestsRes] = await Promise.all([
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
      supabase
        .from("service_requests")
        .select("id, requester_name, requester_type, description, budget, city, state, latitude, longitude, category_id, profile_id, service_categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
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
    if (requestsRes.data) {
      setServiceRequests(
        requestsRes.data.map((s: any) => ({
          id: s.id,
          requester_name: s.requester_name,
          requester_type: s.requester_type,
          description: s.description,
          budget: s.budget,
          city: s.city,
          state: s.state,
          latitude: s.latitude,
          longitude: s.longitude,
          category_name: s.service_categories?.name || "Serviço",
          category_id: s.category_id,
          profile_id: s.profile_id,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-trigger AI Match when data is loaded and user is logged in
  useEffect(() => {
    if (loading || !user || autoMatchTriggered) return;
    if (userMode === "provider" && serviceRequests.length === 0) return;
    if (userMode === "client" && providers.length === 0) return;

    const runAutoMatch = async () => {
      try {
        const { data: myProfile } = await supabase.rpc("get_my_profile_id");
        if (!myProfile) return;

        if (userMode === "provider") {
          const taskIds = serviceRequests.map((r) => r.id);
          if (taskIds.length === 0) return;
          await fetchScoresForProfessional(myProfile, taskIds);
        } else {
          const { data: myTasks } = await supabase
            .from("service_requests")
            .select("id, description, budget, city, category_id, service_categories(name)")
            .eq("profile_id", myProfile)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1);

          if (!myTasks || myTasks.length === 0) return;
          const task = myTasks[0] as any;
          const providerIds = providers.map((p) => p.id);
          await fetchScoresForTask(
            task.description,
            task.service_categories?.name || "",
            task.city,
            task.budget,
            providerIds
          );
        }
        setMatchActive(true);
        setAutoMatchTriggered(true);
        updateParam("sort", "match");
      } catch (e) {
        console.error("Auto AI Match error:", e);
      }
    };
    runAutoMatch();
  }, [loading, user, userMode, serviceRequests, providers, autoMatchTriggered, fetchScoresForTask, fetchScoresForProfessional]);

  // Reset auto-match when mode changes
  useEffect(() => {
    setAutoMatchTriggered(false);
    setMatchActive(false);
  }, [userMode]);

  // Check which demands the user already applied to
  const handleApply = useCallback(async (req: ServiceRequest) => {
    if (!user) {
      toast({ title: "Faça login para se candidatar", description: "Você precisa estar logado como profissional.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (!req.profile_id) {
      toast({ title: "Não foi possível contatar o solicitante", variant: "destructive" });
      return;
    }
    setApplyingId(req.id);
    try {
      const { data: myProfile } = await supabase.rpc("get_my_profile_id");
      if (!myProfile) throw new Error("Perfil não encontrado");
      if (myProfile === req.profile_id) {
        toast({ title: "Você não pode se candidatar à sua própria tarefa", variant: "destructive" });
        return;
      }
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(participant_1.eq.${myProfile},participant_2.eq.${req.profile_id}),and(participant_1.eq.${req.profile_id},participant_2.eq.${myProfile})`)
        .maybeSingle();
      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({ participant_1: myProfile, participant_2: req.profile_id })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = newConv.id;
      }
      const msg = `Olá! Tenho interesse na sua tarefa de "${req.category_name}": "${req.description.slice(0, 100)}..."${req.budget ? ` (Orçamento: R$ ${req.budget})` : ""}. Gostaria de conversar sobre essa oportunidade!`;
      await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: myProfile, content: msg });
      // Record the application in task_applications table
      await supabase.from("task_applications").upsert({
        service_request_id: req.id,
        applicant_profile_id: myProfile,
        conversation_id: conversationId,
        status: "pending",
      }, { onConflict: "service_request_id,applicant_profile_id" });
      toast({ title: "Candidatura enviada!", description: "Uma mensagem foi enviada ao solicitante." });
      setAppliedIds((prev) => new Set(prev).add(req.id));
      navigate(`/chat?conversation=${conversationId}`);
    } catch (err: any) {
      toast({ title: "Erro ao se candidatar", description: err.message, variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  }, [user, navigate, toast]);

  const handleAIMatch = useCallback(async () => {
    if (!user) {
      toast({ title: "Faça login para usar o Match IA", variant: "destructive" });
      return;
    }
    setMatchActive(true);
    try {
      const { data: myProfile } = await supabase.rpc("get_my_profile_id");
      if (!myProfile) {
        toast({ title: "Perfil não encontrado", variant: "destructive" });
        return;
      }

      if (userMode === "provider") {
        // Professional looking for matching tasks
        const taskIds = serviceRequests.map((r) => r.id);
        if (taskIds.length === 0) {
          toast({ title: "Nenhuma tarefa disponível para avaliar" });
          return;
        }
        await fetchScoresForProfessional(myProfile, taskIds);
        toast({ title: "🎯 Match IA concluído!", description: "Tarefas ordenadas por compatibilidade." });
        updateParam("sort", "match");
      } else {
        // Client looking for matching professionals — needs a task description
        // Use the first active task from the user or prompt
        const { data: myTasks } = await supabase
          .from("service_requests")
          .select("id, description, budget, city, category_id, service_categories(name)")
          .eq("profile_id", myProfile)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!myTasks || myTasks.length === 0) {
          toast({
            title: "Crie uma tarefa primeiro",
            description: "Para usar o Match IA, publique uma tarefa descrevendo o que você precisa.",
            variant: "destructive",
          });
          return;
        }

        const task = myTasks[0] as any;
        const providerIds = providers.map((p) => p.id);
        await fetchScoresForTask(
          task.description,
          task.service_categories?.name || "",
          task.city,
          task.budget,
          providerIds
        );
        toast({ title: "🎯 Match IA concluído!", description: "Profissionais ordenados por compatibilidade." });
        updateParam("sort", "match");
      }
    } catch (e) {
      console.error("AI Match error:", e);
      toast({ title: "Erro ao calcular match", variant: "destructive" });
    }
  }, [user, userMode, serviceRequests, providers, fetchScoresForTask, fetchScoresForProfessional, toast, updateParam]);

  const cities = useMemo(() => {
    if (userMode === "client") {
      return [...new Set(providers.map((p) => p.city).filter(Boolean))].sort() as string[];
    }
    return [...new Set(serviceRequests.map((r) => r.city).filter(Boolean))].sort() as string[];
  }, [providers, serviceRequests, userMode]);

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
        const serviceMatch = providerServices.get(p.id)?.some((s) => s.categoryName.toLowerCase().includes(q));
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
    if (viewMode === "map" && !showAll) {
      result = result.filter((p) => {
        if (p.latitude == null || p.longitude == null) return false;
        return getDistanceKm(userLocation[0], userLocation[1], p.latitude, p.longitude) <= radius;
      });
    } else if (viewMode === "map") {
      result = result.filter((p) => p.latitude != null && p.longitude != null);
    }
    result.sort((a, b) => {
      if (sortBy === "name") return a.display_name.localeCompare(b.display_name);
      if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "rating") return (reviewStats.get(b.id)?.avg || 0) - (reviewStats.get(a.id)?.avg || 0);
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
      if (sortBy === "match") {
        const scoreA = matchScores.get(a.id)?.score || 0;
        const scoreB = matchScores.get(b.id)?.score || 0;
        return scoreB - scoreA;
      }
      return 0;
    });
    return result;
  }, [providers, searchQuery, selectedCategory, selectedCity, sortBy, services, providerServices, reviewStats, viewMode, radius, userLocation, showAll, matchScores]);

  const filteredRequests = useMemo(() => {
    let result = [...serviceRequests];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.category_name.toLowerCase().includes(q) ||
          r.requester_name.toLowerCase().includes(q)
      );
    }
    if (selectedCategory !== "all") {
      result = result.filter((r) => r.category_id === selectedCategory);
    }
    if (selectedCity !== "all") {
      result = result.filter((r) => r.city === selectedCity);
    }
    if (viewMode === "map" && !showAll) {
      result = result.filter((r) => {
        if (r.latitude == null || r.longitude == null) return false;
        return getDistanceKm(userLocation[0], userLocation[1], r.latitude, r.longitude) <= radius;
      });
    } else if (viewMode === "map") {
      result = result.filter((r) => r.latitude != null && r.longitude != null);
    }
    result.sort((a, b) => {
      if (sortBy === "recent") return 0;
      if (sortBy === "price_asc") return (a.budget ?? Infinity) - (b.budget ?? Infinity);
      if (sortBy === "price_desc") return (b.budget ?? 0) - (a.budget ?? 0);
      if (sortBy === "name") return a.requester_name.localeCompare(b.requester_name);
      if (sortBy === "match") {
        const scoreA = matchScores.get(a.id)?.score || 0;
        const scoreB = matchScores.get(b.id)?.score || 0;
        return scoreB - scoreA;
      }
      return 0;
    });
    return result;
  }, [serviceRequests, searchQuery, selectedCategory, selectedCity, sortBy, viewMode, radius, userLocation, showAll, matchScores]);

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
      return filteredRequests
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => ({
          id: r.id,
          lat: r.latitude!,
          lng: r.longitude!,
          name: r.requester_name,
          subtitle: r.category_name,
          type: "client" as const,
        }));
    }
  }, [filtered, filteredRequests, userMode, providerServices]);

  const handleModeChange = (mode: UserMode) => {
    setUserMode(mode);
    const params = new URLSearchParams(searchParams);
    params.set("mode", mode);
    setSearchParams(params, { replace: true });
  };

  const currentCount = userMode === "client" ? filtered.length : filteredRequests.length;
  const countLabel = userMode === "client" ? "profissional(is)" : "tarefa(s)";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-6 pt-24 pb-16 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold font-display">Buscar</h1>
            <p className="text-muted-foreground mt-1">
              {loading ? "Carregando..." : `${currentCount} ${countLabel} encontrado(s)`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex items-center gap-2 bg-secondary rounded-xl p-1">
              <button
                onClick={() => handleModeChange("client")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  userMode === "client"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Profissionais
              </button>
              <button
                onClick={() => handleModeChange("provider")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  userMode === "provider"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tarefas
              </button>
            </div>

            <Button
              onClick={handleAIMatch}
              disabled={matchLoading}
              variant={matchActive ? "default" : "outline"}
              size="sm"
              className="gap-1.5 text-sm"
              title={matchActive ? "Clique para recalcular" : "Match IA"}
            >
              {matchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {matchActive ? "Match IA ✓" : matchLoading ? "Calculando..." : "Match IA"}
            </Button>

            {userMode === "provider" && (
              <CreateServiceRequest categories={categories} onCreated={fetchData} />
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-6 bg-card border border-border rounded-xl px-4 py-3">
          {userMode === "client"
            ? "🔍 Encontre profissionais próximos a você. Use o mapa para visualizar a localização e o raio de busca."
            : "📋 Encontre tarefas de clientes e empresas que precisam dos seus serviços. Candidate-se às oportunidades!"}
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
        ) : userMode === "client" ? (
          viewMode === "map" ? (
            <div className="mt-6">
              <p className="text-xs text-muted-foreground font-medium mb-2">
                {filtered.length} profissional(is) no mapa
              </p>
              <SearchMap
                markers={mapMarkers}
                center={userLocation}
                radius={showAll ? 0 : radius}
                onMarkerClick={(id) => navigate(`/provider/${id}`)}
                className="h-[500px] lg:h-[600px] rounded-xl border border-border overflow-hidden"
              />
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
                  matchScore={matchScores.get(provider.id)?.score}
                  matchReasons={matchScores.get(provider.id)?.reasons}
                />
              ))}
            </div>
          )
        ) : (
          viewMode === "map" ? (
            <div className="mt-6">
              <p className="text-xs text-muted-foreground font-medium mb-2">
                {filteredRequests.length} tarefa(s) no mapa{!showAll ? ` em ${radius}km` : ""}
              </p>
              <SearchMap
                markers={mapMarkers}
                center={userLocation}
                radius={showAll ? 0 : radius}
                className="h-[500px] lg:h-[600px] rounded-xl border border-border overflow-hidden"
                markerLabel="S"
              />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-medium text-foreground">Nenhuma tarefa encontrada</p>
              <p className="text-muted-foreground mt-1">Tente ajustar seus filtros</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
              {filteredRequests.map((req) => (
                <ServiceRequestCard
                  key={req.id}
                  req={req}
                  onApply={handleApply}
                  applying={applyingId === req.id}
                  applied={appliedIds.has(req.id)}
                  onGoChat={() => navigate("/chat")}
                  matchScore={matchScores.get(req.id)?.score}
                  matchReasons={matchScores.get(req.id)?.reasons}
                />
              ))}
            </div>
          )
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Search;
