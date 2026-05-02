import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import CreateServiceRequest from "@/components/search/CreateServiceRequest";
import { useUpgradePopup } from "@/hooks/useUpgradePopup";
import { Loader2, MapPin, Search as SearchIcon, LocateFixed, Briefcase, ListChecks, List, Map as MapIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMatchScores } from "@/hooks/useMatchScores";
import { useIsMobile } from "@/hooks/use-mobile";
import ProviderListCard from "@/components/search/ProviderListCard";
import TaskListCard from "@/components/search/TaskListCard";
import ProviderDetailPanel from "@/components/search/ProviderDetailPanel";
import TaskDetailPanel from "@/components/search/TaskDetailPanel";
import SearchMap, { type MapMarker } from "@/components/search/SearchMap";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "map";
const SCROLL_KEY = (mode: string) => `search:scroll:${mode}`;
const SEL_KEY = (mode: string) => `search:sel:${mode}`;

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

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewStats, setReviewStats] = useState<Map<string, { avg: number; count: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const { scores: matchScores, fetchScoresForTask, fetchScoresForProfessional } = useMatchScores();
  const [autoMatchTriggered, setAutoMatchTriggered] = useState(false);
  const [isBasicUser, setIsBasicUser] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([-14.235, -51.9253]);
  const [locating, setLocating] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpenMobile, setDetailOpenMobile] = useState(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);

  // Indeed-style filters (above the list)
  const [filterAvailableToday, setFilterAvailableToday] = useState(false);
  const [filterNearest, setFilterNearest] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | null>(null);

  // View mode (list vs map) + radius for map search
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get("view") as ViewMode) === "map" ? "map" : "list"
  );
  const [radius, setRadius] = useState<number>(Number(searchParams.get("radius")) || 25);
  const [showAll, setShowAll] = useState(false);

  // Top search bar (Indeed-style two fields)
  const [whatField, setWhatField] = useState(searchParams.get("q") || "");
  const [whereField, setWhereField] = useState(searchParams.get("city") || "");

  const userMode: UserMode = (searchParams.get("mode") as UserMode) || "client";
  const selectedCategory = searchParams.get("category") || "all";

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "" || value === "all") params.delete(key);
    else params.set(key, value);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).single().then(({ data: prof }) => {
      if (!prof) return;
      supabase.from("subscriptions").select("id").eq("profile_id", prof.id).eq("status", "active").maybeSingle().then(({ data: sub }) => {
        setIsBasicUser(!sub);
      });
    });
  }, [user]);

  const requestLocation = useCallback(async () => {
    setLocating(true);
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      if (data.latitude && data.longitude) {
        setUserLocation([data.latitude, data.longitude]);
        setHasLocation(true);
        setLocating(false);
        if (data.city) setWhereField(data.city);
        toast({ title: "Localização detectada!", description: `${data.city || ""}, ${data.region || ""}` });
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
        setHasLocation(true);
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
      supabase.from("profiles").select("id, display_name, bio, city, state, avatar_url, verification_status, created_at, latitude, longitude").eq("user_type", "provider").eq("is_active", true),
      supabase.from("provider_services").select("provider_id, category_id, hourly_rate, service_categories(name)"),
      supabase.from("service_categories").select("id, name, slug").order("name"),
      supabase.from("reviews").select("reviewed_id, rating"),
      supabase.from("service_requests").select("id, requester_name, requester_type, description, budget, city, state, latitude, longitude, category_id, profile_id, service_categories(name)").eq("is_active", true).order("created_at", { ascending: false }),
    ]);

    if (profilesRes.data) setProviders(profilesRes.data as ProviderProfile[]);
    if (servicesRes.data) {
      setServices(servicesRes.data.map((s: any) => ({
        provider_id: s.provider_id,
        category_id: s.category_id,
        hourly_rate: s.hourly_rate,
        category_name: s.service_categories?.name || "",
      })));
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
      setServiceRequests(requestsRes.data.map((s: any) => ({
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
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto AI match
  useEffect(() => {
    if (loading || !user || autoMatchTriggered) return;
    if (userMode === "provider" && serviceRequests.length === 0) return;
    if (userMode === "client" && providers.length === 0) return;
    const run = async () => {
      try {
        const { data: myProfile } = await supabase.rpc("get_my_profile_id");
        if (!myProfile) return;
        if (userMode === "provider") {
          await fetchScoresForProfessional(myProfile, serviceRequests.map((r) => r.id));
        } else {
          const { data: myTasks } = await supabase.from("service_requests").select("id, description, budget, city, category_id, service_categories(name)").eq("profile_id", myProfile).eq("is_active", true).order("created_at", { ascending: false }).limit(1);
          if (!myTasks || myTasks.length === 0) return;
          const task = myTasks[0] as any;
          await fetchScoresForTask(task.description, task.service_categories?.name || "", task.city, task.budget, providers.map((p) => p.id));
        }
        setAutoMatchTriggered(true);
      } catch (e) { console.error(e); }
    };
    run();
  }, [loading, user, userMode, serviceRequests, providers, autoMatchTriggered, fetchScoresForTask, fetchScoresForProfessional]);

  useEffect(() => { setAutoMatchTriggered(false); setSelectedId(null); }, [userMode]);

  const { triggerUpgrade } = useUpgradePopup();

  const handleApply = useCallback(async (req: ServiceRequest) => {
    if (!user) {
      toast({ title: "Faça login para se candidatar", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (isBasicUser) {
      triggerUpgrade("Para se candidatar a tarefas ilimitadas, assine o Plano Pro.");
      return;
    }
    setApplyingId(req.id);
    try {
      const { data: myProfile } = await supabase.rpc("get_my_profile_id");
      if (!myProfile) throw new Error("Perfil não encontrado");
      if (myProfile === req.profile_id) {
        toast({ title: "Você não pode se candidatar à sua própria tarefa", variant: "destructive" });
        setApplyingId(null);
        return;
      }
      if (!req.profile_id) {
        await supabase.from("task_applications").upsert({ service_request_id: req.id, applicant_profile_id: myProfile, status: "pending" }, { onConflict: "service_request_id,applicant_profile_id" });
        toast({ title: "Candidatura registrada!" });
        setAppliedIds((prev) => new Set(prev).add(req.id));
        setApplyingId(null);
        return;
      }
      const { data: existing } = await supabase.from("conversations").select("id").or(`and(participant_1.eq.${myProfile},participant_2.eq.${req.profile_id}),and(participant_1.eq.${req.profile_id},participant_2.eq.${myProfile})`).maybeSingle();
      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: newConv, error } = await supabase.from("conversations").insert({ participant_1: myProfile, participant_2: req.profile_id }).select("id").single();
        if (error) throw error;
        conversationId = newConv.id;
      }
      const msg = `Olá! Tenho interesse na sua tarefa de "${req.category_name}": "${req.description.slice(0, 100)}..."${req.budget ? ` (Orçamento: R$ ${req.budget})` : ""}.`;
      await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: myProfile, content: msg });
      await supabase.from("task_applications").upsert({ service_request_id: req.id, applicant_profile_id: myProfile, conversation_id: conversationId, status: "pending" }, { onConflict: "service_request_id,applicant_profile_id" });
      toast({ title: "Candidatura enviada!" });
      setAppliedIds((prev) => new Set(prev).add(req.id));
      navigate(`/chat?conversation=${conversationId}`);
    } catch (err: any) {
      toast({ title: "Erro ao se candidatar", description: err.message, variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  }, [user, navigate, toast, isBasicUser, triggerUpgrade]);

  const providerServices = useMemo(() => {
    const map = new Map<string, { categoryName: string; hourlyRate: number | null }[]>();
    services.forEach((s) => {
      if (!map.has(s.provider_id)) map.set(s.provider_id, []);
      map.get(s.provider_id)!.push({ categoryName: s.category_name, hourlyRate: s.hourly_rate });
    });
    return map;
  }, [services]);

  const filteredProviders = useMemo(() => {
    let result = [...providers];
    const q = whatField.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const nameMatch = p.display_name.toLowerCase().includes(q);
        const bioMatch = p.bio?.toLowerCase().includes(q);
        const serviceMatch = providerServices.get(p.id)?.some((s) => s.categoryName.toLowerCase().includes(q));
        return nameMatch || bioMatch || serviceMatch;
      });
    }
    const where = whereField.trim().toLowerCase();
    if (where) {
      result = result.filter((p) =>
        (p.city || "").toLowerCase().includes(where) || (p.state || "").toLowerCase().includes(where)
      );
    }
    if (selectedCategory !== "all") {
      const ids = new Set(services.filter((s) => s.category_id === selectedCategory).map((s) => s.provider_id));
      result = result.filter((p) => ids.has(p.id));
    }
    if (filterTopRated) {
      result = result.filter((p) => (reviewStats.get(p.id)?.avg || 0) >= 4);
    }
    if (filterMaxPrice != null) {
      result = result.filter((p) => {
        const rates = providerServices.get(p.id)?.map((s) => s.hourlyRate).filter((r): r is number => r != null) || [];
        return rates.length > 0 && Math.min(...rates) <= filterMaxPrice;
      });
    }
    // Sort
    result.sort((a, b) => {
      if (filterNearest && hasLocation) {
        const dA = a.latitude != null ? getDistanceKm(userLocation[0], userLocation[1], a.latitude, a.longitude!) : Infinity;
        const dB = b.latitude != null ? getDistanceKm(userLocation[0], userLocation[1], b.latitude, b.longitude!) : Infinity;
        return dA - dB;
      }
      if (filterTopRated) return (reviewStats.get(b.id)?.avg || 0) - (reviewStats.get(a.id)?.avg || 0);
      const ms = (matchScores.get(b.id)?.score || 0) - (matchScores.get(a.id)?.score || 0);
      if (ms !== 0) return ms;
      return a.display_name.localeCompare(b.display_name);
    });
    return result;
  }, [providers, whatField, whereField, selectedCategory, services, providerServices, reviewStats, filterTopRated, filterNearest, filterMaxPrice, hasLocation, userLocation, matchScores]);

  const filteredRequests = useMemo(() => {
    let result = [...serviceRequests];
    const q = whatField.trim().toLowerCase();
    if (q) {
      result = result.filter((r) =>
        r.description.toLowerCase().includes(q) ||
        r.category_name.toLowerCase().includes(q) ||
        r.requester_name.toLowerCase().includes(q)
      );
    }
    const where = whereField.trim().toLowerCase();
    if (where) {
      result = result.filter((r) =>
        (r.city || "").toLowerCase().includes(where) || (r.state || "").toLowerCase().includes(where)
      );
    }
    if (selectedCategory !== "all") result = result.filter((r) => r.category_id === selectedCategory);
    if (filterMaxPrice != null) result = result.filter((r) => r.budget != null && r.budget <= filterMaxPrice);
    result.sort((a, b) => {
      if (filterNearest && hasLocation) {
        const dA = a.latitude != null ? getDistanceKm(userLocation[0], userLocation[1], a.latitude, a.longitude!) : Infinity;
        const dB = b.latitude != null ? getDistanceKm(userLocation[0], userLocation[1], b.latitude, b.longitude!) : Infinity;
        return dA - dB;
      }
      const ms = (matchScores.get(b.id)?.score || 0) - (matchScores.get(a.id)?.score || 0);
      if (ms !== 0) return ms;
      return 0;
    });
    return result;
  }, [serviceRequests, whatField, whereField, selectedCategory, filterMaxPrice, filterNearest, hasLocation, userLocation, matchScores]);

  // Auto-select first item
  useEffect(() => {
    if (loading) return;
    const list = userMode === "client" ? filteredProviders : filteredRequests;
    if (list.length === 0) { setSelectedId(null); return; }
    if (!selectedId || !list.find((x) => x.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [loading, userMode, filteredProviders, filteredRequests, selectedId]);

  const handleModeChange = (mode: UserMode) => {
    const params = new URLSearchParams(searchParams);
    params.set("mode", mode);
    setSearchParams(params, { replace: true });
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (isMobile) setDetailOpenMobile(true);
  };

  const triggerSearch = () => {
    updateParam("q", whatField);
    updateParam("city", whereField);
  };

  const selectedProvider = userMode === "client" ? filteredProviders.find((p) => p.id === selectedId) : null;
  const selectedRequest = userMode === "provider" ? filteredRequests.find((r) => r.id === selectedId) : null;

  const renderDetailPanel = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      );
    }
    if (userMode === "client" && selectedProvider) {
      return (
        <ProviderDetailPanel
          id={selectedProvider.id}
          displayName={selectedProvider.display_name}
          bio={selectedProvider.bio}
          city={selectedProvider.city}
          state={selectedProvider.state}
          avatarUrl={selectedProvider.avatar_url}
          verified={selectedProvider.verification_status === "verified"}
          services={providerServices.get(selectedProvider.id) || []}
          avgRating={reviewStats.get(selectedProvider.id)?.avg}
          reviewCount={reviewStats.get(selectedProvider.id)?.count}
          latitude={selectedProvider.latitude}
          longitude={selectedProvider.longitude}
        />
      );
    }
    if (userMode === "provider" && selectedRequest) {
      return (
        <TaskDetailPanel
          id={selectedRequest.id}
          requesterName={selectedRequest.requester_name}
          requesterType={selectedRequest.requester_type}
          description={selectedRequest.description}
          budget={selectedRequest.budget}
          city={selectedRequest.city}
          state={selectedRequest.state}
          categoryName={selectedRequest.category_name}
          applied={appliedIds.has(selectedRequest.id)}
          applying={applyingId === selectedRequest.id}
          onApply={() => handleApply(selectedRequest)}
          onGoChat={() => navigate("/chat")}
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-10">
        <SearchIcon className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="font-medium text-foreground">Selecione um item à esquerda</p>
        <p className="text-sm text-muted-foreground mt-1">Os detalhes aparecerão aqui.</p>
      </div>
    );
  };

  const currentList = userMode === "client" ? filteredProviders : filteredRequests;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Sticky search bar (Indeed style) */}
      <div className="sticky top-16 z-30 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex flex-col lg:flex-row gap-2 items-stretch">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 self-start">
              <button
                onClick={() => handleModeChange("client")}
                className={cn(
                  "px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all",
                  userMode === "client" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                )}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Profissionais
              </button>
              <button
                onClick={() => handleModeChange("provider")}
                className={cn(
                  "px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all",
                  userMode === "provider" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                )}
              >
                <ListChecks className="w-3.5 h-3.5" />
                Tarefas
              </button>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={whatField}
                  onChange={(e) => setWhatField(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && triggerSearch()}
                  placeholder="Qual serviço você precisa?"
                  className="pl-10 h-11"
                />
              </div>
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={whereField}
                  onChange={(e) => setWhereField(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && triggerSearch()}
                  placeholder="Seu endereço ou cidade"
                  className="pl-10 pr-10 h-11"
                />
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locating}
                  title="Usar minha localização"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                >
                  <LocateFixed className={cn("w-4 h-4", locating && "animate-spin")} />
                </button>
              </div>
              <Button onClick={triggerSearch} className="h-11 px-6">Buscar</Button>
            </div>

            {userMode === "provider" && (
              <CreateServiceRequest categories={categories} onCreated={fetchData} />
            )}
          </div>
        </div>
      </div>

      {/* Main two-column area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-6 py-4 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* LEFT: list 40% */}
        <div className="lg:w-2/5 lg:max-w-[480px] flex flex-col min-h-0">
          {/* Filters above list */}
          <div className="rounded-xl border border-border bg-card p-3 mb-3 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedCategory} onValueChange={(v) => updateParam("category", v)}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterMaxPrice == null ? "all" : String(filterMaxPrice)}
                onValueChange={(v) => setFilterMaxPrice(v === "all" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Até R$ X" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer preço</SelectItem>
                  <SelectItem value="50">Até R$ 50</SelectItem>
                  <SelectItem value="100">Até R$ 100</SelectItem>
                  <SelectItem value="200">Até R$ 200</SelectItem>
                  <SelectItem value="500">Até R$ 500</SelectItem>
                  <SelectItem value="1000">Até R$ 1000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={filterAvailableToday} onCheckedChange={(v) => setFilterAvailableToday(!!v)} />
                <span>Disponível hoje</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={filterNearest} onCheckedChange={(v) => setFilterNearest(!!v)} />
                <span>Mais próximos</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={filterTopRated} onCheckedChange={(v) => setFilterTopRated(!!v)} />
                <span>Melhor avaliados</span>
              </label>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-2 px-1">
            {loading ? "Carregando..." : `${currentList.length} resultado(s)`}
          </p>

          {/* Scrollable list */}
          <div className="flex-1 lg:overflow-y-auto lg:pr-2 -mr-2 space-y-2.5 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : currentList.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum resultado. Ajuste os filtros.
              </div>
            ) : userMode === "client" ? (
              filteredProviders.map((p) => {
                const dist = hasLocation && p.latitude != null && p.longitude != null
                  ? getDistanceKm(userLocation[0], userLocation[1], p.latitude, p.longitude)
                  : undefined;
                const svc = providerServices.get(p.id) || [];
                const minRate = svc.map((s) => s.hourlyRate).filter((r): r is number => r != null).sort((a, b) => a - b)[0];
                const stats = reviewStats.get(p.id);
                return (
                  <ProviderListCard
                    key={p.id}
                    id={p.id}
                    displayName={p.display_name}
                    avatarUrl={p.avatar_url}
                    city={p.city}
                    state={p.state}
                    verified={p.verification_status === "verified"}
                    primarySpecialty={svc[0]?.categoryName}
                    distanceKm={dist}
                    availableToday={undefined}
                    servicesDone={stats?.count}
                    startingPrice={minRate}
                    avgRating={stats?.avg}
                    reviewCount={stats?.count}
                    selected={selectedId === p.id}
                    onSelect={() => handleSelect(p.id)}
                  />
                );
              })
            ) : (
              filteredRequests.map((r) => {
                const dist = hasLocation && r.latitude != null && r.longitude != null
                  ? getDistanceKm(userLocation[0], userLocation[1], r.latitude, r.longitude)
                  : undefined;
                const nearbyCount = providers.filter((p) => p.latitude != null && p.longitude != null && r.latitude != null && r.longitude != null && getDistanceKm(p.latitude, p.longitude, r.latitude, r.longitude) <= 25).length;
                const durationLabel = dist != null ? `~${dist.toFixed(1)} km` : undefined;
                return (
                  <TaskListCard
                    key={r.id}
                    id={r.id}
                    title={r.description.slice(0, 100)}
                    categoryName={r.category_name}
                    requesterType={r.requester_type}
                    basePrice={r.budget}
                    estimatedDurationLabel={durationLabel}
                    nearbyProvidersCount={nearbyCount}
                    city={r.city}
                    state={r.state}
                    selected={selectedId === r.id}
                    onSelect={() => handleSelect(r.id)}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: detail panel 60% — desktop only */}
        <div className="hidden lg:flex flex-1 min-h-0">
          <div className="w-full rounded-xl border border-border bg-card overflow-hidden flex flex-col lg:sticky lg:top-[200px] lg:h-[calc(100vh-220px)]">
            {renderDetailPanel()}
          </div>
        </div>
      </div>

      {/* MOBILE detail sheet */}
      {isMobile && (
        <Sheet open={detailOpenMobile} onOpenChange={setDetailOpenMobile}>
          <SheetContent side="bottom" className="h-[92vh] p-0 rounded-t-2xl">
            <div className="h-full">{renderDetailPanel()}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export default Search;
