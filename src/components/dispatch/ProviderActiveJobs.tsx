import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { MapPin, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type ActiveJob = {
  id: string
  service_request_id: string | null
  distance_km: number | null
  metadata: any
  responded_at: string | null
}

interface Props {
  profileId: string | null
  onArrived?: () => void
  onFinished?: () => void
  busy?: boolean
}

/** Painel do profissional: serviços aceitos vindos do radar, chegada e retorno à disponibilidade */
export function ProviderActiveJobs({ profileId, onArrived, onFinished, busy }: Props) {
  const [jobs, setJobs] = useState<ActiveJob[]>([])
  const [arrived, setArrived] = useState<Record<string, boolean>>({})
  const [working, setWorking] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profileId) return
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('service_offers')
      .select('id, service_request_id, distance_km, metadata, responded_at')
      .eq('provider_id', profileId)
      .eq('status', 'accepted')
      .gte('offered_at', since)
      .order('offered_at', { ascending: false })
    setJobs((data as ActiveJob[]) ?? [])
  }, [profileId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!profileId) return
    const channel = supabase
      .channel(`provider-active-jobs-${profileId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_offers', filter: `provider_id=eq.${profileId}` },
        () => void load()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profileId, load])

  if (!profileId || jobs.length === 0) return null

  return (
    <div className="space-y-3" data-testid="provider-active-jobs">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Em atendimento ({jobs.length})
      </Label>
      {jobs.map((j) => {
        const price = Number(j.metadata?.quoted_price ?? j.metadata?.budget ?? 0)
        const done = !!arrived[j.id]
        return (
          <Card key={j.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {j.metadata?.category_name ?? 'Serviço aceito'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {j.metadata?.description ?? 'Solicitação do radar'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {j.distance_km != null ? `${Number(j.distance_km).toFixed(1)} km` : 'distância indisponível'}
                  </p>
                </div>
                {price > 0 && (
                  <Badge variant="secondary">
                    {price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                {!done ? (
                  <Button
                    className="flex-1"
                    disabled={working === j.id}
                    onClick={async () => {
                      setWorking(j.id)
                      try {
                        await onArrived?.()
                        setArrived((p) => ({ ...p, [j.id]: true }))
                        toast.success('Chegada confirmada.')
                      } finally {
                        setWorking(null)
                      }
                    }}
                  >
                    {working === j.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
                    Cheguei ao local
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={working === j.id || !busy}
                    onClick={async () => {
                      setWorking(j.id)
                      try {
                        await onFinished?.()
                        toast.success('Você está disponível novamente.')
                      } finally {
                        setWorking(null)
                      }
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Concluir e ficar disponível
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default ProviderActiveJobs
