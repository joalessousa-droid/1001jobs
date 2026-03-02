import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, DollarSign, Search, Building2, User, Map, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchMap, { MapMarker } from "@/components/search/SearchMap";
import CreateServiceRequest from "@/components/search/CreateServiceRequest";

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
}

interface Category {
  id: string;
  name: string;
}

const SearchServices = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [requestsRes, categoriesRes] = await Promise.all([
      supabase
        .from("service_requests")
        .select("id, requester_name, requester_type, description, budget, city, state, latitude, longitude, category_id, service_categories(name)")
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
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = requests.filter((s) => {
    const matchesSearch =
      !searchTerm ||
      s.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.requester_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || s.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const mapMarkers: MapMarker[] = filtered
    .filter((s) => s.latitude && s.longitude)
    .map((s) => ({
      id: s.id,
      lat: s.latitude!,
      lng: s.longitude!,
      name: s.requester_name,
      subtitle: s.category_name,
      type: "client" as const,
    }));

  const mapCenter: [number, number] = mapMarkers.length > 0
    ? [mapMarkers.reduce((a, m) => a + m.lat, 0) / mapMarkers.length, mapMarkers.reduce((a, m) => a + m.lng, 0) / mapMarkers.length]
    : [-14.235, -51.9253];

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
                Demandas de pessoas e empresas buscando profissionais
              </p>
            </div>
            <CreateServiceRequest categories={categories} onCreated={fetchData} />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar demanda, categoria ou solicitante..."
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
            <div className="flex gap-1">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("map")}
              >
                <Map className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Map View */}
          {viewMode === "map" && (
            <div className="mb-8 rounded-2xl border border-border overflow-hidden">
              <SearchMap
                markers={mapMarkers}
                center={mapCenter}
                radius={0}
                className="h-[500px]"
                markerLabel="S"
              />
            </div>
          )}

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse" />
              ))}
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
                  className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group"
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
