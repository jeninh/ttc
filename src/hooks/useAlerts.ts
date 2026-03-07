import { useState, useEffect, useCallback } from 'react'
import { fetchAlerts, type TTCAlert } from '../services/alerts'

export function useAlerts(refreshInterval = 60_000) {
  const [alerts, setAlerts] = useState<TTCAlert[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAlerts()
      setAlerts(data)
    } catch {
      // use cached
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, refreshInterval)
    return () => clearInterval(timer)
  }, [refresh, refreshInterval])

  return { alerts, loading, refresh }
}
