import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, Users, UserX, DollarSign, TrendingUp, ShieldAlert,
  FileWarning, Siren, RefreshCw, MapPin
} from "lucide-react";
import { Link } from "react-router-dom";

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

interface KpiState {
  openCalls: number;
  callsToday: number;
  completedToday: number;
  onlineProviders: number;
  offlineProviders: number;
  revenueDay: number;
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
  updated_at: string;
}

interface EmergencyPin {
  id: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  protocol: string | null;
}

const ONLINE_WINDOW_MIN = 5;

export default function AdminExecutiveDashboard() {
  const { ready: mapReady, error: mapError } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [kpi, setKpi] = useState<KpiState>({
    openCalls: 0, callsToday: 0, completedToday: 0,
    onlineProviders: 0, offlineProviders: 0,
    revenueDay: 0, revenueMonth: 0, conversionRate: 0,
    fraudAvg: 0, fraudHigh: 0, claimsOpen: 0, emergenciesOpen: 0,
  });
  const [providers, setProviders] = useState<ProviderPin[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadAll = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString();

    const [
      openCallsQ, callsTodayQ, completedTodayQ,
      onlineQ, providersTotalQ,
      revDayQ, revMonthQ,
      fraudQ, fraudHighQ,
      claimsQ, emergQ,
      provLocsQ, emergPinsQ,
    ] = await Promise.all([
      supabase.from("services").select("id", { count: "exact", head: true })
        .in("status", ["pending", "accepted", "in_progress", "confirmed"]),
      supabase.from("services").select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay.toISOString()),
      supabase.from("services").select("id", { count: "exact", head: true })
        .eq("status", "completed").gte("completed_at", startOfDay.toISOString()),
      supabase.from("provider_locations").select("provider_id", { count: "exact", head: true })
        .eq("is_sharing", true).gte("updated_at", onlineSince),
      supabase.from("profiles").select("id", { count: "exact", head: true })
        .eq("user_type", "provider").eq("is_active", true),
      supabase.from("service_payments").select("amount, platform_fee")
        .in("state", ["captured", "released"]).gte("captured_at", startOfDay.toISOString()),
      supabase.from("service_payments").select("amount, platform_fee")
        .in("state", ["captured", "released"]).gte("captured_at", startOfMonth.toISOString()),
      supabase.from("fraud_scores").select("score"),
      supabase.from("fraud_scores").select("id", { count: "exact", head: true }).eq("risk_level", "high"),
      supabase.from("insurance_claims").select("id", { count: "exact", head: true })
        .in("status", ["open", "under_review", "pending_documents"]),
      supabase.from("emergency_alerts").select("id", { count: "exact", head: true })
        .in("status", ["open", "acknowledged"]),
      supabase.from("provider_locations").select("provider_id, latitude, longitude, updated_at")
        .eq("is_sharing", true).gte("updated_at", onlineSince).limit(500),
      supabase.from("emergency_alerts").select("id, latitude, longitude, status, protocol")
        .in("status", ["open", "acknowledged"]).limit(200),
    ]);

    const sum = (rows: any[] | null) =>
      (rows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

    const fraudRows = (fraudQ.data || []) as { score: number }[];
    const fraudAvg = fraudRows.length
      ? fraudRows.reduce((a, b) => a + Number(b.score || 0), 0) / fraudRows.length
      : 0;

    const callsToday = callsTodayQ.count || 0;
    const completedToday = completedTodayQ.count || 0;
    const onlineProv = onlineQ.count || 0;
    const totalProv = providersTotalQ.count || 0;

    setKpi({
      openCalls: openCallsQ.count || 0,
      callsToday,
      completedToday,
      onlineProviders: onlineProv,
      offlineProviders: Math.max(0, totalProv - onlineProv),
      revenueDay: sum(revDayQ.data),
      revenueMonth: sum(revMonthQ.data),
      conversionRate: callsToday > 0 ? (completedToday / callsToday) * 100 : 0,
      fraudAvg,
      fraudHigh: fraudHighQ.count || 0,
      claimsOpen: claimsQ.count || 0,
      emergenciesOpen: emergQ.count || 0,
    });
    setProviders((provLocsQ.data || []) as ProviderPin[]);
    setEmergencies((emergPinsQ.data || []) as EmergencyPin[]);
    setLoading(false);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30_000);

    const ch = supabase
      .channel("exec-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "service_payments" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_alerts" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_locations" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "fraud_scores" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "insurance_claims" }, () => loadAll())
      .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(ch); };
  }, [loadAll]);

  // Init map
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: -14.235, lng: -51.9253 }, // centro do Brasil
      zoom: 4,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
        { featureType: "water", stylers: [{ color: "#0b1224" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
        { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#334155" }] },
      ],
    });
  }, [mapReady]);

  // Refresh markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    providers.forEach(p => {
      if (p.latitude == null || p.longitude == null) return;
      const m = new window.google.maps.Marker({
        position: { lat: Number(p.latitude), lng: Number(p.longitude) },
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: "#22c55e",
          fillOpacity: 0.9,
          strokeColor: "#052e16",
          strokeWeight: 1,
        },
      });
      markersRef.current.push(m);
    });

    emergencies.forEach(e => {
      if (e.latitude == null || e.longitude == null) return;
      const m = new window.google.maps.Marker({
        position: { lat: Number(e.latitude), lng: Number(e.longitude) },
        map: mapInstanceRef.current,
        title: `SOS ${e.protocol || ""}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#ef4444",
          fillOpacity: 0.95,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        zIndex: 999,
      });
      markersRef.current.push(m);
    });
  }, [providers, emergencies]);

  const fraudColor = useMemo(() => {
    if (kpi.fraudAvg >= 70) return "text-red-500";
    if (kpi.fraudAvg >= 40) return "text-amber-400";
    return "text-emerald-400";
  }, [kpi.fraudAvg]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada em tempo real · Última atualização {lastUpdate.toLocaleTimeString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Realtime
          </Badge>
          <Button size="sm" variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Kpi icon={<Activity className="h-4 w-4" />} label="Chamados abertos" value={kpi.openCalls}
             sub={`${kpi.callsToday} hoje`} accent="text-blue-400" />
        <Kpi icon={<Users className="h-4 w-4" />} label="Prestadores online" value={kpi.onlineProviders}
             accent="text-emerald-400" />
        <Kpi icon={<UserX className="h-4 w-4" />} label="Prestadores offline" value={kpi.offlineProviders}
             accent="text-muted-foreground" />
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="Receita do dia" value={BRL(kpi.revenueDay)}
             accent="text-emerald-400" />
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="Receita do mês" value={BRL(kpi.revenueMonth)}
             accent="text-emerald-400" />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Taxa de conversão"
             value={`${kpi.conversionRate.toFixed(1)}%`}
             sub={`${kpi.completedToday}/${kpi.callsToday}`} accent="text-blue-400" />
        <Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Score antifraude médio"
             value={kpi.fraudAvg.toFixed(0)} sub={`${kpi.fraudHigh} em alto risco`} accent={fraudColor} />
        <Kpi icon={<FileWarning className="h-4 w-4" />} label="Sinistros abertos" value={kpi.claimsOpen}
             accent="text-amber-400" />
        <Kpi icon={<Siren className="h-4 w-4" />} label="Emergências abertas" value={kpi.emergenciesOpen}
             accent="text-red-500" />
        <Kpi icon={<MapPin className="h-4 w-4" />} label="Pinos no mapa"
             value={providers.length + emergencies.length} accent="text-muted-foreground" />
      </div>

      {/* Mapa Nacional */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Mapa Nacional · Prestadores e Emergências</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Emergência</span>
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
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; accent?: string;
}) {
  return (
    <Card>
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
    <Link to={to}
      className="block rounded-md border bg-card hover:bg-accent transition-colors p-3 text-sm font-medium">
      {label} →
    </Link>
  );
}
