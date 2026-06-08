import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Users, DollarSign, AlertTriangle, Radio, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface DashboardData {
  generated_at: string
  live_offers: number
  queued_offers: number
  providers_online: number
  providers_offline: number
  active_services: number
  open_disputes: number
  revenue_today: number
  revenue_month: number
  conversion_rate: number
  matching_attempts_24h: number
  top_online_providers: Array<{ provider_id: string; last_seen_at: string; current_load: number }>
}

function StatCard({ icon: Icon, label, value, hint }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <Icon className="h-8 w-8 text-primary opacity-70" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminDispatchDashboard() {
  const { t } = useTranslation()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_dispatch_dashboard')
    if (error) setError(error.message)
    else setData(data as unknown as DashboardData)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    const channels = [
      supabase.channel('dash-offers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_offers' }, () => load())
        .subscribe(),
      supabase.channel('dash-avail')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'provider_availability' }, () => load())
        .subscribe(),
      supabase.channel('dash-logs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_matching_logs' }, () => load())
        .subscribe(),
    ]
    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [load])

  if (error) return <div className="p-6 text-destructive">Erro: {error}</div>
  if (!data) return <div className="p-6">Carregando…</div>

  const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("admin.dispatchTitle")}</h1>
        <Badge variant="outline" className="gap-1">
          <Radio className="h-3 w-3 text-green-500" /> ao vivo
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Chamados ao vivo" value={data.live_offers} hint={`+${data.queued_offers} na fila`} />
        <StatCard icon={Users} label="Prestadores online" value={data.providers_online} hint={`${data.providers_offline} offline`} />
        <StatCard icon={Clock} label="Serviços ativos" value={data.active_services} />
        <StatCard icon={AlertTriangle} label="Disputas abertas" value={data.open_disputes} />
        <StatCard icon={DollarSign} label="Receita do dia" value={fmtBRL(Number(data.revenue_today))} />
        <StatCard icon={DollarSign} label="Receita do mês" value={fmtBRL(Number(data.revenue_month))} />
        <StatCard icon={Activity} label="Taxa de conversão" value={`${data.conversion_rate}%`} hint="ofertas aceitas (24h)" />
        <StatCard icon={Radio} label="Matches 24h" value={data.matching_attempts_24h} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prestadores online (top 20 por atividade)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.top_online_providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum prestador online no momento.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {data.top_online_providers.map(p => (
                <div key={p.provider_id} className="flex items-center justify-between p-2 border rounded">
                  <code className="text-xs">{p.provider_id.slice(0, 8)}…</code>
                  <span className="text-xs text-muted-foreground">
                    carga {p.current_load} · visto {new Date(p.last_seen_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
