export interface TTCAlert {
  id: string
  title: string
  description: string
  routeType: string
  route: string
  severity: string
  effect: string
  cause: string
  lastUpdated: string
  isActive: boolean
  stopStart?: string
  stopEnd?: string
}

const ALERTS_URL = 'https://alerts.ttc.ca/api/alerts/live-alerts'
let cachedAlerts: TTCAlert[] = []
let lastFetch = 0

export async function fetchAlerts(): Promise<TTCAlert[]> {
  if (Date.now() - lastFetch < 60_000 && cachedAlerts.length > 0) return cachedAlerts

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(ALERTS_URL)}`
    const res = await fetch(proxyUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const alerts: TTCAlert[] = []

    const addAlerts = (arr: any[], type?: string) => {
      for (const a of arr) {
        alerts.push({
          id: a.id ?? String(Math.random()),
          title: a.customHeaderText || a.headerText || a.title || 'Service Alert',
          description: a.description || '',
          routeType: type ?? (a.routeType || 'unknown').toLowerCase(),
          route: a.route || '',
          severity: a.severity || '',
          effect: a.effectDesc || a.effect || '',
          cause: a.causeDescription || a.cause || '',
          lastUpdated: a.lastUpdated || new Date().toISOString(),
          isActive: true,
          stopStart: a.stopStart || '',
          stopEnd: a.stopEnd || '',
        })
      }
    }

    if (Array.isArray(data.routes)) addAlerts(data.routes)
    if (Array.isArray(data.siteWideCustom)) addAlerts(data.siteWideCustom)
    if (Array.isArray(data.accessibility)) addAlerts(data.accessibility, 'elevator')

    cachedAlerts = alerts
    lastFetch = Date.now()
    return alerts
  } catch {
    return cachedAlerts
  }
}
