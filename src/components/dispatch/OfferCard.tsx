import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, MapPin, Star, User, FileText, DollarSign } from 'lucide-react'
import type { ServiceOffer } from '@/hooks/useIncomingOffers'

interface Props {
  offer: ServiceOffer
  onAccept: (id: string) => Promise<void> | void
  onDecline: (id: string) => Promise<void> | void
  onQuote?: (id: string, price: number) => Promise<void> | void
}

export function OfferCard({ offer, onAccept, onDecline, onQuote }: Props) {
  const [price, setPrice] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)

  const expiresAt = new Date(offer.expires_at).getTime()
  const offeredAt = new Date(offer.offered_at).getTime()
  // Derive window from backend (offered_at -> expires_at) instead of hardcoding 30s,
  // so visual timer stays in sync if backend tunes the offer TTL.
  const total = Math.max(1_000, expiresAt - offeredAt)

  useEffect(() => {
    // Higher cadence near expiry for smoother countdown; backend cron runs every ~10s.
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [offer.id, offer.expires_at])

  const remaining = Math.max(0, expiresAt - now)
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

        {(() => {
          const m = (offer.metadata ?? {}) as any
          const fmtMoney = (v: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: m.currency ?? 'BRL' }).format(v)
          return (
            <div className="space-y-2">
              {m.budget != null && (
                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <DollarSign className="h-4 w-4 text-primary" />
                  {fmtMoney(Number(m.budget))}
                </div>
              )}
              {m.client_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{m.client_name}</span>
                  {m.city && <span className="text-muted-foreground">· {m.city}{m.state ? `/${m.state}` : ''}</span>}
                </div>
              )}
              {m.category_name && (
                <Badge variant="secondary" className="text-xs">{m.category_name}</Badge>
              )}
              {m.description && (
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="line-clamp-3">{m.description}</p>
                </div>
              )}
            </div>
          )
        })()}

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground border-t pt-2">
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
        {onQuote && (
          <div className="space-y-1.5 border-t pt-2">
            <p className="text-xs text-muted-foreground">
              Informe o preço do serviço — o cliente aceita clicando no valor.
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                step="0.01"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={expired || busy}
              />
              <Button
                variant="secondary"
                disabled={expired || busy || !(Number(price) > 0)}
                onClick={guarded(() => onQuote(offer.id, Number(price)))}
              >
                Enviar preço
              </Button>
            </div>
            {(offer.metadata as any)?.quoted_price != null && (
              <p className="text-xs text-primary">
                Preço enviado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                  .format(Number((offer.metadata as any).quoted_price))}
              </p>
            )}
          </div>
        )}

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
