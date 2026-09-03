import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface ServiceOffer {
  id: string
  service_request_id: string | null
  service_id: string | null
  client_id: string
  provider_id: string
  status: string
  match_score: number
  distance_km: number | null
  radius_km: number | null
  expires_at: string
  offered_at: string
  metadata: any
}

export function useIncomingOffers(profileId?: string | null) {
  const [offers, setOffers] = useState<ServiceOffer[]>([])

  const refresh = useCallback(async () => {
    if (!profileId) return
    const { data } = await supabase
      .from('service_offers')
      .select('*')
      .eq('provider_id', profileId)
      .in('status', ['pending', 'quoted'])
      .gt('expires_at', new Date().toISOString())
      .order('offered_at', { ascending: false })
    setOffers((data ?? []) as ServiceOffer[])
  }, [profileId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!profileId) return
    const channel = supabase
      .channel(`offers-${profileId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_offers',
        filter: `provider_id=eq.${profileId}`,
      }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profileId, refresh])

  const accept = useCallback(async (offerId: string) => {
    const { data, error } = await supabase.rpc('accept_service_offer', { _offer_id: offerId })
    await refresh()
    if (error) throw error
    return data as string | null
  }, [refresh])

  /** Profissional envia o preço do serviço; o cliente aceita clicando no valor */
  const quote = useCallback(async (offerId: string, price: number, note?: string) => {
    const { error } = await supabase.rpc('quote_service_offer' as any, {
      _offer_id: offerId,
      _price: price,
      _note: note ?? null,
    })
    await refresh()
    if (error) throw error
  }, [refresh])

  const decline = useCallback(async (offerId: string) => {
    const { error } = await supabase.rpc('decline_service_offer', { _offer_id: offerId })
    await refresh()
    if (error) throw error
  }, [refresh])

  return { offers, accept, quote, decline, refresh }
}
