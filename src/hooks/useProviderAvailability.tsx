import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useProviderAvailability(profileId?: string | null) {
  const [isOnline, setIsOnline] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profileId) return
    supabase
      .from('provider_availability')
      .select('is_online, is_busy')
      .eq('provider_id', profileId)
      .maybeSingle()
      .then(({ data }) => {
        setIsOnline(!!data?.is_online)
        setIsBusy(!!data?.is_busy)
      })
  }, [profileId])

  const setOnline = useCallback(async (online: boolean) => {
    if (!profileId) return
    setLoading(true)
    await supabase.from('provider_availability').upsert({
      provider_id: profileId,
      is_online: online,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setIsOnline(online)
    setLoading(false)
  }, [profileId])

  /** Marca o profissional como em deslocamento/atendimento ou disponível novamente */
  const setBusy = useCallback(async (busy: boolean) => {
    if (!profileId) return
    setLoading(true)
    await supabase.from('provider_availability').upsert({
      provider_id: profileId,
      is_online: true,
      is_busy: busy,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setIsOnline(true)
    setIsBusy(busy)
    setLoading(false)
  }, [profileId])

  // Heartbeat every 60s while online
  useEffect(() => {
    if (!profileId || !isOnline) return
    const t = setInterval(() => {
      supabase.from('provider_availability').update({
        last_seen_at: new Date().toISOString(),
      }).eq('provider_id', profileId)
    }, 60_000)
    return () => clearInterval(t)
  }, [profileId, isOnline])

  return { isOnline, setOnline, isBusy, setBusy, loading }
}
