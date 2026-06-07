import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, Star } from 'lucide-react'
import type { ServiceOffer } from '@/hooks/useIncomingOffers'

interface Props {
  offer: ServiceOffer
  onAccept: (id: string) => Promise<void> | void
  onDecline: (id: string) => Promise<void> | void
}

export function OfferCard({ offer, onAccept, onDecline }: Props) {
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const total = 30_000
  const remaining = Math.max(0, new Date(offer.expires_at).getTime() - now)
  const seconds = Math.ceil(remaining / 1000)
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100))
  const expired = remaining <= 0

  const guarded = (fn: () => Promise<void> | void) => async () => {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <Card className="border-primary/50 shadow-lg animate-in fade-in slide-in-from-top-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Nova oferta de Tarefa</CardTitle>
          <Badge variant={expired ? 'destructive' : 'default'} className="gap-1">
            <Clock className="h-3 w-3" /> {expired ? 'Expirou' : `${seconds}s`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} />
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4" /> Score {offer.match_score.toFixed(1)}
          </span>
          {offer.distance_km != null && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {offer.distance_km.toFixed(1)} km
            </span>
          )}
          {offer.radius_km != null && (
            <span>Raio {offer.radius_km} km</span>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            disabled={expired || busy}
            onClick={guarded(() => onAccept(offer.id))}
          >
            Aceitar
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={expired || busy}
            onClick={guarded(() => onDecline(offer.id))}
          >
            Recusar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
