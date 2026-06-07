import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useProviderAvailability(profileId?: string | null) {
  const [isOnline, setIsOnline] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profileId) return
    supabase
      .from('provider_availability')
      .select('is_online')
      .eq('provider_id', profileId)
      .maybeSingle()
      .then(({ data }) => setIsOnline(!!data?.is_online))
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

  return { isOnline, setOnline, loading }
}
