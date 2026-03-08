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
  stopStart: string
  stopEnd: string
  direction: string
  alertType: string
  isActive: boolean
}

// In dev, use Vite proxy. In prod, try direct (may work with CORS) or use allorigins proxy.
const ALERTS_URL_DIRECT = 'https://alerts.ttc.ca/api/alerts/live-alerts'
const ALERTS_URL_PROXY = '/api/ttc-alerts'

let cachedAlerts: TTCAlert[] = []
let lastFetch = 0

export async function fetchAlerts(): Promise<TTCAlert[]> {
  if (Date.now() - lastFetch < 30_000 && cachedAlerts.length > 0) {
    return cachedAlerts
  }

  try {
    let res: Response
    if (import.meta.env.DEV) {
      res = await fetch(ALERTS_URL_PROXY)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } else {
      // In production, alerts.ttc.ca doesn't send CORS headers, so use proxy
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(ALERTS_URL_DIRECT)}`
      res = await fetch(proxyUrl)
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
    }

    const data = await res.json()
    const alerts: TTCAlert[] = []

    if (data.routes && Array.isArray(data.routes)) {
      for (const a of data.routes) {
        alerts.push({
          id: a.id ?? String(Math.random()),
          title: a.customHeaderText || a.headerText || a.title || 'Service Alert',
          description: a.description || '',
          routeType: (a.routeType || 'unknown').toLowerCase(),
          route: a.route || '',
          severity: a.severity || '',
          effect: a.effectDesc || a.effect || '',
          cause: a.causeDescription || a.cause || '',
          lastUpdated: a.lastUpdated || new Date().toISOString(),
          stopStart: a.stopStart || '',
          stopEnd: a.stopEnd || '',
          direction: a.direction || '',
          alertType: a.alertType || '',
          isActive: true,
        })
      }
    }

    // siteWideCustom contains subway closures/service alerts
    if (data.siteWideCustom && Array.isArray(data.siteWideCustom)) {
      for (const a of data.siteWideCustom) {
        alerts.push({
          id: a.id ?? `sw-${Math.random()}`,
          title: a.customHeaderText || a.headerText || a.title || 'Service Alert',
          description: a.description || '',
          routeType: (a.routeType || 'unknown').toLowerCase(),
          route: a.route || '',
          severity: a.severity || '',
          effect: a.effectDesc || a.effect || '',
          cause: a.causeDescription || a.cause || '',
          lastUpdated: a.lastUpdated || new Date().toISOString(),
          stopStart: a.stopStart || '',
          stopEnd: a.stopEnd || '',
          direction: a.direction || '',
          alertType: a.alertType || '',
          isActive: true,
        })
      }
    }

    if (data.accessibility && Array.isArray(data.accessibility)) {
      for (const a of data.accessibility) {
        alerts.push({
          id: a.id ?? `acc-${Math.random()}`,
          title: a.customHeaderText || a.headerText || a.title || 'Accessibility Alert',
          description: a.description || '',
          routeType: 'elevator',
          route: a.route || '',
          severity: a.severity || '',
          effect: a.effectDesc || a.effect || '',
          cause: a.causeDescription || a.cause || '',
          lastUpdated: a.lastUpdated || new Date().toISOString(),
          stopStart: a.stopStart || '',
          stopEnd: a.stopEnd || '',
          direction: '',
          alertType: a.alertType || '',
          isActive: true,
        })
      }
    }

    cachedAlerts = alerts
    lastFetch = Date.now()

    try {
      localStorage.setItem('ttc-alerts', JSON.stringify(alerts))
      localStorage.setItem('ttc-alerts-time', String(Date.now()))
    } catch {}

    return alerts
  } catch (err) {
    console.warn('Failed to fetch TTC alerts:', err)
    try {
      const cached = localStorage.getItem('ttc-alerts')
      if (cached) {
        cachedAlerts = JSON.parse(cached)
        return cachedAlerts
      }
    } catch {}
    return cachedAlerts
  }
}

export function getSubwayAlerts(alerts: TTCAlert[]): TTCAlert[] {
  return alerts.filter((a) => a.routeType === 'subway')
}
