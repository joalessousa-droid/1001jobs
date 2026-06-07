import { useAuth } from '@/hooks/useAuth'
import { useIncomingOffers } from '@/hooks/useIncomingOffers'
import { useProviderAvailability } from '@/hooks/useProviderAvailability'
import { OfferCard } from './OfferCard'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

export function IncomingOffersPanel() {
  const { profile } = useAuth()
  const profileId = profile?.id
  const { offers, accept, decline } = useIncomingOffers(profileId)
  const { isOnline, setOnline, loading } = useProviderAvailability(profileId)

  if (!profile || profile.user_type !== 'provider') return null

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <Label className="font-semibold">Disponível para receber ofertas</Label>
            <p className="text-xs text-muted-foreground">
              Quando online, você recebe ofertas de Tarefa em até 30s.
            </p>
          </div>
          <Switch checked={isOnline} disabled={loading} onCheckedChange={setOnline} />
        </CardContent>
      </Card>

      {offers.length === 0 && isOnline && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aguardando novas ofertas…
        </p>
      )}

      <div className="space-y-3">
        {offers.map(o => (
          <OfferCard
            key={o.id}
            offer={o}
            onAccept={async (id) => {
              try {
                await accept(id)
                toast.success('Oferta aceita!')
              } catch (e: any) { toast.error(e.message ?? 'Erro ao aceitar') }
            }}
            onDecline={async (id) => {
              try {
                await decline(id)
                toast.message('Oferta recusada')
              } catch (e: any) { toast.error(e.message ?? 'Erro') }
            }}
          />
        ))}
      </div>
    </div>
  )
}
