import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { MapPin, DollarSign, Search, Building2, User, List, LocateFixed, Send, Loader2 } from "lucide-react";
import ShareButton from "@/components/search/ShareButton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MapIcon } from "lucide-react";
import SearchMap, { MapMarker } from "@/components/search/SearchMap";
import CreateServiceRequest from "@/components/search/CreateServiceRequest";
import { useToast } from "@/hooks/use-toast";

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

interface Category {
  id: string;
  name: string;
}

type ViewMode = "list" | "map";

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SearchServices = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [radius, setRadius] = useState(25);
  const [showAll, setShowAll] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number]>([-14.235, -51.9253]);
  const [locating, setLocating] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

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
    const [requestsRes, categoriesRes] = await Promise.all([
      supabase
        .from("service_requests")
        .select("id, requester_name, requester_type, description, budget, city, state, latitude, longitude, category_id, profile_id, service_categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_categories")
        .select("id, name")
        .order("name", { ascending: true }),
    ]);

    if (categoriesRes.data) setCategories(categoriesRes.data);

    if (requestsRes.data) {
      setRequests(
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
        toast({ title: "Você não pode se candidatar à sua própria demanda", variant: "destructive" });
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
      const msg = `Olá! Tenho interesse na sua demanda de "${req.category_name}": "${req.description.slice(0, 100)}..."${req.budget ? ` (Orçamento: R$ ${req.budget})` : ""}. Gostaria de conversar sobre essa oportunidade!`;
      await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: myProfile, content: msg });
      toast({ title: "Candidatura enviada!", description: "Uma mensagem foi enviada ao solicitante." });
      setAppliedIds((prev) => new Set(prev).add(req.id));
      navigate(`/chat?conversation=${conversationId}`);
    } catch (err: any) {
      toast({ title: "Erro ao se candidatar", description: err.message, variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  }, [user, navigate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check which demands the user already applied to
  useEffect(() => {
    if (!user || requests.length === 0) return;
    const checkApplied = async () => {
      const { data: myProfile } = await supabase.rpc("get_my_profile_id");
      if (!myProfile) return;
      const profileIds = [...new Set(requests.map((r) => r.profile_id).filter(Boolean))] as string[];
      if (profileIds.length === 0) return;
      const { data: convos } = await supabase
        .from("conversations")
        .select("participant_1, participant_2")
        .or(profileIds.map((pid) => `and(participant_1.eq.${myProfile},participant_2.eq.${pid}),and(participant_1.eq.${pid},participant_2.eq.${myProfile})`).join(","));
      if (!convos) return;
      const connectedProfiles = new Set(convos.map((c) => c.participant_1 === myProfile ? c.participant_2 : c.participant_1));
      const applied = new Set(requests.filter((r) => r.profile_id && connectedProfiles.has(r.profile_id)).map((r) => r.id));
      setAppliedIds(applied);
    };
    checkApplied();
  }, [user, requests]);

  const cities = useMemo(() => {
    const unique = [...new Set(requests.map((r) => r.city).filter(Boolean))] as string[];
    return unique.sort();
  }, [requests]);

  const filtered = useMemo(() => {
    let result = requests.filter((s) => {
      const matchesSearch =
        !searchTerm ||
        s.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.requester_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || s.category_id === selectedCategory;
      const matchesCity = selectedCity === "all" || s.city === selectedCity;
      return matchesSearch && matchesCategory && matchesCity;
    });

    if (viewMode === "map" && !showAll) {
      result = result.filter((r) => {
        if (r.latitude == null || r.longitude == null) return false;
        return getDistanceKm(userLocation[0], userLocation[1], r.latitude, r.longitude) <= radius;
      });
    } else if (viewMode === "map") {
      result = result.filter((r) => r.latitude != null && r.longitude != null);
    }

    result.sort((a, b) => {
      if (sortBy === "recent") return 0; // already sorted by created_at desc from DB
      if (sortBy === "budget_asc") return (a.budget ?? Infinity) - (b.budget ?? Infinity);
      if (sortBy === "budget_desc") return (b.budget ?? 0) - (a.budget ?? 0);
      if (sortBy === "name") return a.requester_name.localeCompare(b.requester_name);
      return 0;
    });

    return result;
  }, [requests, searchTerm, selectedCategory, selectedCity, sortBy, viewMode, radius, userLocation, showAll]);

  const mapMarkers: MapMarker[] = useMemo(
    () =>
      filtered
        .filter((s) => s.latitude && s.longitude)
        .map((s) => ({
          id: s.id,
          lat: s.latitude!,
          lng: s.longitude!,
          name: s.requester_name,
          subtitle: s.category_name,
          type: "client" as const,
        })),
    [filtered]
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">
                Buscar <span className="text-gradient">Serviços</span>
              </h1>
              <p className="text-muted-foreground">
                {loading
                  ? "Carregando..."
                  : `${filtered.length} demanda(s) encontrada(s)`}
              </p>
            </div>
            <CreateServiceRequest categories={categories} onCreated={fetchData} />
          </div>

          {/* Filters */}
          <div className="space-y-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar demanda, categoria ou solicitante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 bg-card border-border"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px] bg-card border-border">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="w-[160px] bg-card border-border">
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] bg-card border-border">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="budget_asc">Menor orçamento</SelectItem>
                  <SelectItem value="budget_desc">Maior orçamento</SelectItem>
                  <SelectItem value="name">Nome</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* View toggle + Location + Radius */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : viewMode === "map" ? (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">
                {filtered.length} demanda(s) no mapa{!showAll ? ` em ${radius}km` : ""}
              </p>
              <SearchMap
                markers={mapMarkers}
                center={userLocation}
                radius={showAll ? 0 : radius}
                className="h-[500px] lg:h-[600px] rounded-xl border border-border overflow-hidden"
                markerLabel="S"
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">Nenhuma demanda encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group relative"
                >
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ShareButton url={`/servicos?task=${req.id}`} title={req.category_name} text={`Demanda de ${req.category_name}: ${req.description.slice(0, 100)}${req.budget ? ` - Orçamento: R$ ${req.budget}` : ""}`} />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {req.category_name}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {req.requester_type === "company" ? <Building2 className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                      {req.requester_type === "company" ? "Empresa" : "Pessoa"}
                    </Badge>
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
                    {appliedIds.has(req.id) ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5 text-xs"
                        onClick={() => navigate("/chat")}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Candidatado ✓
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        disabled={applyingId === req.id}
                        onClick={() => handleApply(req)}
                      >
                        {applyingId === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Me candidatar
                      </Button>
                    )}
                  </div>
                </div>
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
