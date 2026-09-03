import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { useIncomingOffers } from '@/hooks/useIncomingOffers'
import { useProviderAvailability } from '@/hooks/useProviderAvailability'
import { OfferCard } from './OfferCard'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

export function IncomingOffersPanel() {
  const { user } = useAuth()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [userType, setUserType] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('id, user_type').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        setProfileId(data?.id ?? null)
        setUserType(data?.user_type ?? null)
      })
  }, [user])

  const { offers, accept, quote, decline } = useIncomingOffers(profileId)
  const { isOnline, setOnline, isBusy, setBusy, loading } = useProviderAvailability(profileId)

  if (!user || userType !== 'provider') return null

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <Label className="font-semibold flex items-center gap-2">
              Disponível para receber ofertas
              {isOnline && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
              )}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isBusy
                ? 'Em deslocamento/atendimento — novas ofertas ficam em espera.'
                : 'Quando online, você recebe ofertas de Tarefa do radar em tempo real.'}
            </p>
          </div>
          <Switch checked={isOnline} disabled={loading} onCheckedChange={setOnline} />
        </CardContent>
      </Card>

      <ProviderActiveJobs
        profileId={profileId}
        busy={isBusy}
        onArrived={() => setBusy(true)}
        onFinished={() => setBusy(false)}
      />

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
            onQuote={async (id, price) => {
              try {
                await quote(id, price)
                toast.success('Preço enviado ao cliente!')
              } catch (e: any) { toast.error(e.message ?? 'Erro ao enviar preço') }
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
