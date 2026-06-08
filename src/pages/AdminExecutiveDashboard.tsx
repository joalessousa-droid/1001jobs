import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Activity, Users, UserX, DollarSign, TrendingUp, ShieldAlert,
  FileWarning, Siren, RefreshCw, MapPin, BellRing,
} from "lucide-react";
import { Link } from "react-router-dom";
import { KpiDetailDialog, type KpiDetailRow } from "@/components/admin/KpiDetailDialog";
import { EmergencyNotificationsCenter } from "@/components/admin/EmergencyNotificationsCenter";

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

type Period = "today" | "7d" | "30d" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje", "7d": "7 dias", "30d": "30 dias", all: "Tudo",
};

function periodStart(p: Period): Date | null {
  const d = new Date();
  if (p === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (p === "7d") { d.setDate(d.getDate() - 7); return d; }
  if (p === "30d") { d.setDate(d.getDate() - 30); return d; }
  return null;
}

interface KpiState {
  openCalls: number;
  callsPeriod: number;
  completedPeriod: number;
  onlineProviders: number;
  offlineProviders: number;
  revenuePeriod: number;
  revenueMonth: number;
  conversionRate: number;
  fraudAvg: number;
  fraudHigh: number;
  claimsOpen: number;
  emergenciesOpen: number;
}

interface ProviderPin {
  provider_id: string;
  latitude: number;
  longitude: number;
}

interface EmergencyPin {
  id: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  protocol: string | null;
  triggered_at?: string;
}

const ONLINE_WINDOW_MIN = 5;
const PROVIDERS_PAGE = 200;
const PROVIDERS_MAX = 2000;

export default function AdminExecutiveDashboard() {
  const { ready: mapReady, error: mapError } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const providerMarkersRef = useRef<any[]>([]);
  const emergencyMarkersRef = useRef<any[]>([]);

  const [period, setPeriod] = useState<Period>("today");
  const [kpi, setKpi] = useState<KpiState>({
    openCalls: 0, callsPeriod: 0, completedPeriod: 0,
    onlineProviders: 0, offlineProviders: 0,
    revenuePeriod: 0, revenueMonth: 0, conversionRate: 0,
    fraudAvg: 0, fraudHigh: 0, claimsOpen: 0, emergenciesOpen: 0,
  });
  const [providers, setProviders] = useState<ProviderPin[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerProgress, setProviderProgress] = useState({ loaded: 0, total: 0 });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Emergency notifications
  const seenEmergenciesRef = useRef<Set<string>>(new Set());
  const firstEmergencyLoadRef = useRef(true);
  const [newEmergencyIds, setNewEmergencyIds] = useState<Set<string>>(new Set());
  const [onlyNewEmergencies, setOnlyNewEmergencies] = useState(false);

  // Detail dialogs
  const [detail, setDetail] = useState<null | {
    title: string; description?: string; rows: KpiDetailRow[];
    groupByStatus?: boolean; manageHref?: string;
  }>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadKpis = useCallback(async (p: Period) => {
    const since = periodStart(p);
    const sinceIso = since ? since.toISOString() : null;
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString();

    const callsQ = supabase.from("services").select("id", { count: "exact", head: true });
    const completedQ = supabase.from("services").select("id", { count: "exact", head: true }).eq("status", "completed");
    const revQ = supabase.from("service_payments").select("amount").in("state", ["captured", "released"]);
    if (sinceIso) { callsQ.gte("created_at", sinceIso); completedQ.gte("completed_at", sinceIso); revQ.gte("captured_at", sinceIso); }

    const [
      openCallsR, callsR, completedR,
      onlineR, providersTotalR,
      revR, revMonthR,
      fraudR, fraudHighR, claimsR, emergR,
    ] = await Promise.all([
      supabase.from("services").select("id", { count: "exact", head: true })
        .in("status", ["pending", "accepted", "in_progress", "confirmed"]),
      callsQ, completedQ,
      supabase.from("provider_locations").select("provider_id", { count: "exact", head: true })
        .eq("is_sharing", true).gte("updated_at", onlineSince),
      supabase.from("profiles").select("id", { count: "exact", head: true })
        .eq("user_type", "provider").eq("is_active", true),
      revQ,
      supabase.from("service_payments").select("amount").in("state", ["captured", "released"])
        .gte("captured_at", startOfMonth.toISOString()),
      supabase.from("fraud_scores").select("score"),
      supabase.from("fraud_scores").select("id", { count: "exact", head: true }).eq("risk_level", "high"),
      supabase.from("insurance_claims").select("id", { count: "exact", head: true }).in("status", ["open", "in_review"]),
      supabase.from("emergency_alerts").select("id", { count: "exact", head: true }).in("status", ["open", "acknowledged"]),
    ]);

    const sum = (rows: any[] | null) => (rows || []).reduce((a, r) => a + Number(r.amount || 0), 0);
    const fraudRows = (fraudR.data || []) as { score: number }[];
    const fraudAvg = fraudRows.length ? fraudRows.reduce((a, b) => a + Number(b.score || 0), 0) / fraudRows.length : 0;
    const callsCount = callsR.count || 0;
    const completedCount = completedR.count || 0;
    const onlineProv = onlineR.count || 0;
    const totalProv = providersTotalR.count || 0;

    setKpi({
      openCalls: openCallsR.count || 0,
      callsPeriod: callsCount,
      completedPeriod: completedCount,
      onlineProviders: onlineProv,
      offlineProviders: Math.max(0, totalProv - onlineProv),
      revenuePeriod: sum(revR.data),
      revenueMonth: sum(revMonthR.data),
      conversionRate: callsCount > 0 ? (completedCount / callsCount) * 100 : 0,
      fraudAvg, fraudHigh: fraudHighR.count || 0,
      claimsOpen: claimsR.count || 0,
      emergenciesOpen: emergR.count || 0,
    });
    setLoading(false);
    setLastUpdate(new Date());
  }, []);

  // Incremental provider loading
  const loadProvidersIncremental = useCallback(async () => {
    setLoadingProviders(true);
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString();
    let from = 0;
    const collected: ProviderPin[] = [];
    setProviders([]);
    setProviderProgress({ loaded: 0, total: 0 });

    while (from < PROVIDERS_MAX) {
      const { data, error } = await supabase
        .from("provider_locations")
        .select("provider_id, latitude, longitude")
        .eq("is_sharing", true)
        .gte("updated_at", onlineSince)
        .range(from, from + PROVIDERS_PAGE - 1);
      if (error || !data || data.length === 0) break;
      collected.push(...(data as ProviderPin[]));
      // batch flush via idle callback for smoothness
      await new Promise<void>(res => {
        const cb = () => { setProviders([...collected]); setProviderProgress({ loaded: collected.length, total: collected.length }); res(); };
        if ("requestIdleCallback" in window) (window as any).requestIdleCallback(cb, { timeout: 100 });
        else setTimeout(cb, 0);
      });
      if (data.length < PROVIDERS_PAGE) break;
      from += PROVIDERS_PAGE;
    }
    setLoadingProviders(false);
  }, []);

  const loadEmergenciesForMap = useCallback(async () => {
    const { data } = await supabase
      .from("emergency_alerts")
      .select("id, latitude, longitude, status, protocol, triggered_at")
      .in("status", ["open", "acknowledged"])
      .order("triggered_at", { ascending: false })
      .limit(300);
    const list = (data || []) as EmergencyPin[];
    if (firstEmergencyLoadRef.current) {
      list.forEach(e => seenEmergenciesRef.current.add(e.id));
      firstEmergencyLoadRef.current = false;
    } else {
      // mark new
      const fresh = new Set(newEmergencyIds);
      list.forEach(e => { if (!seenEmergenciesRef.current.has(e.id)) { fresh.add(e.id); seenEmergenciesRef.current.add(e.id); } });
      setNewEmergencyIds(fresh);
    }
    setEmergencies(list);
  }, [newEmergencyIds]);

  const refreshAll = useCallback(() => {
    loadKpis(period);
    loadProvidersIncremental();
    loadEmergenciesForMap();
  }, [period, loadKpis, loadProvidersIncremental, loadEmergenciesForMap]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("exec-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => loadKpis(period))
      .on("postgres_changes", { event: "*", schema: "public", table: "service_payments" }, () => loadKpis(period))
      .on("postgres_changes", { event: "*", schema: "public", table: "fraud_scores" }, () => loadKpis(period))
      .on("postgres_changes", { event: "*", schema: "public", table: "insurance_claims" }, () => loadKpis(period))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "emergency_alerts" }, (payload: any) => {
        // Toasts/agrupamento são tratados pelo EmergencyNotificationsCenter
        // (useEmergencyAlerts) com debounce para evitar estouro.
        const e = payload.new as EmergencyPin;
        seenEmergenciesRef.current.add(e.id);
        setNewEmergencyIds(prev => new Set(prev).add(e.id));
        setEmergencies(prev => [e, ...prev.filter(x => x.id !== e.id)]);
        loadKpis(period);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "emergency_alerts" }, () => { loadEmergenciesForMap(); loadKpis(period); })
      .subscribe();
    const interval = setInterval(() => { loadKpis(period); }, 30_000);
    return () => { clearInterval(interval); supabase.removeChannel(ch); };
  }, [period, loadKpis, loadEmergenciesForMap]);

  // Init map
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: -14.235, lng: -51.9253 }, zoom: 4,
      disableDefaultUI: true, zoomControl: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
        { featureType: "water", stylers: [{ color: "#0b1224" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
        { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#334155" }] },
      ],
    });
    clustererRef.current = new MarkerClusterer({
      map: mapInstanceRef.current,
      markers: [],
      algorithm: new SuperClusterAlgorithm({ radius: 60, maxZoom: 12 }),
    });
  }, [mapReady]);

  // Update provider cluster markers
  useEffect(() => {
    if (!clustererRef.current || !window.google) return;
    providerMarkersRef.current.forEach(m => m.setMap(null));
    const markers = providers
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => new window.google.maps.Marker({
        position: { lat: Number(p.latitude), lng: Number(p.longitude) },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5, fillColor: "#22c55e", fillOpacity: 0.9,
          strokeColor: "#052e16", strokeWeight: 1,
        },
      }));
    providerMarkersRef.current = markers;
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(markers);
  }, [providers]);

  // Emergency markers (NOT clustered; always visible on top)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    emergencyMarkersRef.current.forEach(m => m.setMap(null));
    const filtered = onlyNewEmergencies ? emergencies.filter(e => newEmergencyIds.has(e.id)) : emergencies;
    emergencyMarkersRef.current = filtered
      .filter(e => e.latitude != null && e.longitude != null)
      .map(e => new window.google.maps.Marker({
        position: { lat: Number(e.latitude), lng: Number(e.longitude) },
        map: mapInstanceRef.current,
        title: `SOS ${e.protocol || ""}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: newEmergencyIds.has(e.id) ? 11 : 9,
          fillColor: "#ef4444", fillOpacity: 0.95,
          strokeColor: "#fff", strokeWeight: 2,
        },
        zIndex: 999,
      }));
  }, [emergencies, onlyNewEmergencies, newEmergencyIds]);

  const fraudColor = useMemo(() => {
    if (kpi.fraudAvg >= 70) return "text-red-500";
    if (kpi.fraudAvg >= 40) return "text-amber-400";
    return "text-emerald-400";
  }, [kpi.fraudAvg]);

  // ── KPI detail loaders ─────────────────────────────────────────────
  const openDetail = useCallback(async (kind:
    "calls" | "completed" | "revenue" | "fraud" | "claims" | "emergencies" | "online" | "offline") => {
    const since = periodStart(period);
    const sinceIso = since ? since.toISOString() : null;
    setDetail({ title: "Carregando…", rows: [] });
    setDetailLoading(true);

    let rows: KpiDetailRow[] = [];
    let title = ""; let groupByStatus = false; let manageHref: string | undefined;

    if (kind === "calls" || kind === "completed") {
      title = kind === "calls" ? `Chamados (${PERIOD_LABELS[period]})` : `Concluídos (${PERIOD_LABELS[period]})`;
      const q = supabase.from("services").select("id, title, status, created_at, completed_at, agreed_price")
        .order("created_at", { ascending: false }).limit(100);
      if (sinceIso) q.gte("created_at", sinceIso);
      if (kind === "completed") q.eq("status", "completed");
      const { data } = await q;
      rows = (data || []).map((s: any) => ({
        id: s.id, primary: s.title || `Chamado ${s.id.slice(0, 8)}`,
        secondary: s.status, status: s.status, amount: s.agreed_price ? Number(s.agreed_price) : undefined,
        date: s.completed_at || s.created_at, href: `/servico/${s.id}/rastreio`,
      }));
      groupByStatus = true;
      manageHref = "/admin/dispatch";
    } else if (kind === "revenue") {
      title = `Receita (${PERIOD_LABELS[period]})`;
      const q = supabase.from("service_payments")
        .select("id, amount, state, captured_at, service_id")
        .in("state", ["captured", "released"]).order("captured_at", { ascending: false }).limit(100);
      if (sinceIso) q.gte("captured_at", sinceIso);
      const { data } = await q;
      rows = (data || []).map((p: any) => ({
        id: p.id, primary: `Pagamento ${p.id.slice(0, 8)}`,
        secondary: p.service_id ? `Serviço ${String(p.service_id).slice(0, 8)}` : undefined,
        status: p.state, amount: Number(p.amount || 0), date: p.captured_at,
      }));
      groupByStatus = true;
      manageHref = "/admin/pagamentos";
    } else if (kind === "fraud") {
      title = "Scores de antifraude";
      const { data } = await supabase.from("fraud_scores")
        .select("profile_id, score, risk_level, last_evaluated_at, auto_blocked")
        .order("score", { ascending: false }).limit(100);
      rows = (data || []).map((f: any) => ({
        id: f.profile_id, primary: `Perfil ${String(f.profile_id).slice(0, 8)}`,
        secondary: f.auto_blocked ? "Bloqueado automaticamente" : "Ativo",
        status: f.risk_level, amount: Number(f.score), date: f.last_evaluated_at,
        href: `/admin/antifraud/${f.profile_id}`,
      }));
      groupByStatus = true;
      manageHref = "/admin/antifraud";
    } else if (kind === "claims") {
      title = `Sinistros (${PERIOD_LABELS[period]})`;
      const q = supabase.from("insurance_claims")
        .select("id, protocol, status, estimated_amount, created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (sinceIso) q.gte("created_at", sinceIso);
      const { data } = await q;
      rows = (data || []).map((c: any) => ({
        id: c.id, primary: c.protocol || `Sinistro ${c.id.slice(0, 8)}`,
        status: c.status, amount: c.estimated_amount ? Number(c.estimated_amount) : undefined,
        date: c.created_at, href: `/seguros/${c.id}`,
      }));
      groupByStatus = true;
      manageHref = "/admin/seguros";
    } else if (kind === "emergencies") {
      title = `Emergências (${PERIOD_LABELS[period]})`;
      const q = supabase.from("emergency_alerts")
        .select("id, protocol, status, triggered_at, role")
        .order("triggered_at", { ascending: false }).limit(100);
      if (sinceIso) q.gte("triggered_at", sinceIso);
      const { data } = await q;
      rows = (data || []).map((e: any) => ({
        id: e.id, primary: e.protocol ? `SOS ${e.protocol}` : `Alerta ${e.id.slice(0, 8)}`,
        secondary: e.role, status: e.status, date: e.triggered_at,
      }));
      groupByStatus = true;
      manageHref = "/admin/emergencias";
    } else if (kind === "online" || kind === "offline") {
      title = kind === "online" ? "Prestadores online" : "Prestadores offline";
      if (kind === "online") {
        const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString();
        const { data } = await supabase.from("provider_locations")
          .select("provider_id, updated_at").eq("is_sharing", true).gte("updated_at", onlineSince).limit(200);
        const ids = (data || []).map(d => d.provider_id);
        const profMap = new Map<string, any>();
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles")
            .select("id, display_name, city, state").in("id", ids);
          (profs || []).forEach(p => profMap.set(p.id, p));
        }
        rows = (data || []).map((d: any) => {
          const p = profMap.get(d.provider_id);
          return {
            id: d.provider_id, primary: p?.display_name || `Prestador ${d.provider_id.slice(0, 8)}`,
            secondary: p ? [p.city, p.state].filter(Boolean).join(" / ") : undefined,
            date: d.updated_at, href: `/provider/${d.provider_id}`,
          };
        });
      } else {
        const { data } = await supabase.from("profiles")
          .select("id, display_name, city, state").eq("user_type", "provider").eq("is_active", true).limit(200);
        rows = (data || []).map((p: any) => ({
          id: p.id, primary: p.display_name || `Prestador ${p.id.slice(0, 8)}`,
          secondary: [p.city, p.state].filter(Boolean).join(" / "), href: `/provider/${p.id}`,
        }));
      }
    }

    setDetail({ title, rows, groupByStatus, manageHref });
    setDetailLoading(false);
  }, [period]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground">
            Período: <span className="text-foreground font-medium">{PERIOD_LABELS[period]}</span> ·
            Última atualização {lastUpdate.toLocaleTimeString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="all">Tudo</TabsTrigger>
            </TabsList>
          </Tabs>
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Realtime
          </Badge>
          <EmergencyNotificationsCenter />
          <Button size="sm" variant="outline" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Chamados abertos" value={kpi.openCalls}
          sub={`${kpi.callsPeriod} no período`} accent="text-blue-400" onClick={() => openDetail("calls")} />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Prestadores online" value={kpi.onlineProviders}
          accent="text-emerald-400" onClick={() => openDetail("online")} />
        <KpiCard icon={<UserX className="h-4 w-4" />} label="Prestadores offline" value={kpi.offlineProviders}
          accent="text-muted-foreground" onClick={() => openDetail("offline")} />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label={`Receita (${PERIOD_LABELS[period]})`}
          value={BRL(kpi.revenuePeriod)} accent="text-emerald-400" onClick={() => openDetail("revenue")} />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Receita do mês" value={BRL(kpi.revenueMonth)}
          accent="text-emerald-400" onClick={() => openDetail("revenue")} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Taxa de conversão"
          value={`${kpi.conversionRate.toFixed(1)}%`} sub={`${kpi.completedPeriod}/${kpi.callsPeriod}`}
          accent="text-blue-400" onClick={() => openDetail("completed")} />
        <KpiCard icon={<ShieldAlert className="h-4 w-4" />} label="Score antifraude médio"
          value={kpi.fraudAvg.toFixed(0)} sub={`${kpi.fraudHigh} em alto risco`} accent={fraudColor}
          onClick={() => openDetail("fraud")} />
        <KpiCard icon={<FileWarning className="h-4 w-4" />} label="Sinistros abertos" value={kpi.claimsOpen}
          accent="text-amber-400" onClick={() => openDetail("claims")} />
        <KpiCard icon={<Siren className="h-4 w-4" />} label="Emergências abertas"
          value={
            <span className="flex items-center gap-2">
              {kpi.emergenciesOpen}
              {newEmergencyIds.size > 0 && (
                <Badge className="bg-red-500 hover:bg-red-500 text-white animate-pulse">
                  +{newEmergencyIds.size} novas
                </Badge>
              )}
            </span>
          } accent="text-red-500" onClick={() => openDetail("emergencies")} />
        <KpiCard icon={<MapPin className="h-4 w-4" />} label="Pinos no mapa"
          value={providers.length + emergencies.length}
          sub={loadingProviders ? `Carregando ${providerProgress.loaded}…` : undefined}
          accent="text-muted-foreground" />
      </div>

      {/* Mapa Nacional */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            Mapa Nacional · Prestadores e Emergências
            {newEmergencyIds.size > 0 && (
              <Badge variant="destructive" className="gap-1">
                <BellRing className="h-3 w-3" /> {newEmergencyIds.size} nova(s)
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online (cluster)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Emergência</span>
            <div className="flex items-center gap-2">
              <Switch id="only-new" checked={onlyNewEmergencies} onCheckedChange={setOnlyNewEmergencies} />
              <Label htmlFor="only-new" className="cursor-pointer">Somente novas</Label>
            </div>
            {newEmergencyIds.size > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setNewEmergencyIds(new Set())}>
                Limpar marcação
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {mapError ? (
            <div className="h-[420px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
              {mapError}
            </div>
          ) : (
            <div ref={mapRef} className="h-[420px] w-full rounded-md overflow-hidden bg-muted" />
          )}
        </CardContent>
      </Card>

      {/* Atalhos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ShortcutLink to="/admin/emergencias" label="Central de Emergências" />
        <ShortcutLink to="/admin/seguros" label="Sinistros" />
        <ShortcutLink to="/admin/antifraud" label="Antifraude" />
        <ShortcutLink to="/admin/scores" label="Scores" />
        <ShortcutLink to="/admin/dispatch" label="Dispatch" />
        <ShortcutLink to="/admin/eta" label="ETA" />
        <ShortcutLink to="/admin/jobs" label="Jobs Agendados" />
        <ShortcutLink to="/admin/pagamentos" label="Pagamentos" />
      </div>

      <KpiDetailDialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.title || ""}
        rows={detail?.rows || []}
        groupByStatus={detail?.groupByStatus}
        manageHref={detail?.manageHref}
        loading={detailLoading}
      />
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent, onClick }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; accent?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={onClick ? "cursor-pointer transition-colors hover:bg-accent/40" : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className={accent}>{icon}</span>
        </div>
        <div className={`mt-2 text-2xl font-semibold ${accent || ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ShortcutLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="block rounded-md border bg-card hover:bg-accent transition-colors p-3 text-sm font-medium">
      {label} →
    </Link>
  );
}
