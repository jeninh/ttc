const STREETCAR_ROUTES = ['501', '503', '504', '505', '506', '508', '509', '510', '511', '512']
const CACHE_KEY = 'ttc-streetcar-paths'
const CACHE_TIME_KEY = 'ttc-streetcar-paths-time'
// Cache routes for 24 hours since static paths rarely change
const CACHE_TTL = 24 * 60 * 60 * 1000

export type LatLng = [number, number]

export interface StreetcarStop {
  id: string
  title: string
  lat: number
  lng: number
}

export interface StreetcarPath {
  routeId: string
  color: string
  title: string
  paths: LatLng[][]
  stops: StreetcarStop[]
}

export async function fetchStreetcarRoutes(): Promise<StreetcarPath[]> {
  // Check cache first
  try {
    const timeStr = localStorage.getItem(CACHE_TIME_KEY)
    const cached = localStorage.getItem(CACHE_KEY)
    if (timeStr && cached && Date.now() - Number(timeStr) < CACHE_TTL) {
      return JSON.parse(cached)
    }
  } catch (err) {
    console.warn('Failed to read streetcar cache:', err)
  }

  const results: StreetcarPath[] = []

  try {
    // Fetch all streetcar routes in parallel
    const promises = STREETCAR_ROUTES.map(async (routeId) => {
      const res = await fetch(`https://retro.umoiq.com/service/publicJSONFeed?command=routeConfig&a=ttc&r=${routeId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      
      if (!data.route) return null

      // Parse paths
      const paths: LatLng[][] = []
      const routePaths = Array.isArray(data.route.path) ? data.route.path : [data.route.path]
      
      for (const p of routePaths) {
        if (!p || !p.point) continue
        const points = Array.isArray(p.point) ? p.point : [p.point]
        const coords: LatLng[] = points.map((pt: any) => [parseFloat(pt.lat), parseFloat(pt.lon)])
        if (coords.length > 0) {
          paths.push(coords)
        }
      }

      // Parse stops
      const stops: StreetcarStop[] = []
      const routeStops = Array.isArray(data.route.stop) ? data.route.stop : [data.route.stop]
      for (const s of routeStops) {
        if (!s) continue
        stops.push({
          id: `${routeId}-${s.tag}`,
          title: s.title,
          lat: parseFloat(s.lat),
          lng: parseFloat(s.lon),
        })
      }

      return {
        routeId,
        color: `#${data.route.color || 'DA291C'}`, // Default to TTC Red if missing
        title: data.route.title,
        paths,
        stops
      } as StreetcarPath
    })

    const fetched = await Promise.allSettled(promises)
    for (const result of fetched) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      } else if (result.status === 'rejected') {
        console.error('Failed to fetch a streetcar route:', result.reason)
      }
    }

    // Save to cache
    if (results.length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(results))
        localStorage.setItem(CACHE_TIME_KEY, String(Date.now()))
      } catch (err) {
        console.warn('Failed to write streetcar cache:', err)
      }
    }

    return results
  } catch (err) {
    console.error('Failed to fetch streetcars:', err)
    // Fallback to cache without TTL check if API fails
    try {
      const fallback = localStorage.getItem(CACHE_KEY)
      if (fallback) return JSON.parse(fallback)
    } catch {}
    return []
  }
}

import type { Station } from '../data/stations'
import type { GraphEdge } from '../data/lines'

function haversineDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function buildStreetcarGraphEdges(
  streetcars: StreetcarPath[],
  unifiedGraph: Map<string, GraphEdge[]>,
  unifiedStationMap: Map<string, Station>
) {
  // 1. Add all streetcar stops as valid stations in the station map
  for (const sc of streetcars) {
    for (const stop of sc.stops) {
      if (!unifiedStationMap.has(stop.id)) {
        unifiedStationMap.set(stop.id, {
          id: stop.id,
          name: stop.title,
          lat: stop.lat,
          lng: stop.lng,
          lines: [sc.routeId],
        })
      } else {
        // If it exists, ensure this line is tracked
        const existing = unifiedStationMap.get(stop.id)!
        if (!existing.lines.includes(sc.routeId)) {
          existing.lines.push(sc.routeId)
        }
      }
    }
  }

  // Helper to safely add edges
  const addEdge = (from: string, to: string, lineId: string, weight: number) => {
    if (!unifiedGraph.has(from)) unifiedGraph.set(from, [])
    const edges = unifiedGraph.get(from)!
    if (!edges.some(e => e.to === to && e.line === lineId)) {
      edges.push({ to, line: lineId, weight })
    }
  }

  // 2. Add edges between consecutive stops on the same route
  for (const sc of streetcars) {
    for (let i = 0; i < sc.stops.length - 1; i++) {
      const from = sc.stops[i]
      const to = sc.stops[i + 1]
      // Assume ~1.5 min between streetcar stops on average
      addEdge(from.id, to.id, sc.routeId, 1.5)
      addEdge(to.id, from.id, sc.routeId, 1.5)
    }
  }

  // 3. Connect streetcar stops to nearby subway stations (Transfer edges)
  const allSubwayStations = Array.from(unifiedStationMap.values()).filter(s =>
    s.lines.some(l => l === '1' || l === '2' || l === '4' || l === '5')
  )

  for (const sc of streetcars) {
    for (const stop of sc.stops) {
      for (const subway of allSubwayStations) {
        // Only measure distance if not exactly the same ID
        if (stop.id === subway.id) continue

        const distKm = haversineDistKm(stop.lat, stop.lng, subway.lat, subway.lng)
        // If a streetcar stop is within ~200m of a subway, consider it a transfer point (3 mins walking)
        if (distKm <= 0.2) {
          addEdge(stop.id, subway.id, 'transfer', 3)
          addEdge(subway.id, stop.id, 'transfer', 3)
        }
      }
    }
  }
}

