import { useState, useEffect, useCallback, useRef } from 'react'
import { analyzeAlerts, type AffectedSegment } from '../services/gemini'
import type { TTCAlert } from '../services/alerts'

const CACHE_KEY = 'ttc-gemini-segments'
const REFRESH_INTERVAL = 3_600_000 // 1 hour

export function useGeminiAlerts(alerts: TTCAlert[]) {
  const [segments, setSegments] = useState<AffectedSegment[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(true)
  const initialRun = useRef(true)

  const refresh = useCallback(async () => {
    if (alerts.length === 0) {
      setLoading(false)
      return
    }
    try {
      const force = initialRun.current
      initialRun.current = false
      const data = await analyzeAlerts(alerts, force)
      setSegments(data)
    } catch {
      // use cached
    } finally {
      setLoading(false)
    }
  }, [alerts])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [refresh])

  return { segments, loading }
}
