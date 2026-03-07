import { graph, getLineById } from '../data/lines'
import { stationMap, findNearestStation, type Station } from '../data/stations'

export interface RouteStep {
  type: 'walk' | 'ride' | 'transfer'
  from: Station
  to: Station
  line?: string
  lineName?: string
  lineColor?: string
  stations?: Station[] // intermediate stations
  durationMin: number
}

export interface Route {
  steps: RouteStep[]
  totalMin: number
  fromStation: Station
  toStation: Station
}

export function findRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Route | null {
  const fromStation = findNearestStation(fromLat, fromLng)
  const toStation = findNearestStation(toLat, toLng)

  if (fromStation.id === toStation.id) {
    return {
      steps: [
        {
          type: 'walk',
          from: fromStation,
          to: toStation,
          durationMin: 1,
        },
      ],
      totalMin: 1,
      fromStation,
      toStation,
    }
  }

  // Dijkstra's algorithm
  const dist = new Map<string, number>()
  const prev = new Map<string, { stationId: string; line: string } | null>()
  const visited = new Set<string>()

  for (const [id] of graph) {
    dist.set(id, Infinity)
    prev.set(id, null)
  }
  dist.set(fromStation.id, 0)

  while (true) {
    let minDist = Infinity
    let current: string | null = null
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minDist) {
        minDist = d
        current = id
      }
    }
    if (current === null || current === toStation.id) break
    visited.add(current)

    const edges = graph.get(current) ?? []
    for (const edge of edges) {
      const prevEntry = prev.get(current)
      // Add 3 min transfer penalty when switching lines
      const transferPenalty =
        prevEntry && prevEntry.line !== edge.line ? 3 : 0
      const newDist = minDist + edge.weight + transferPenalty
      if (newDist < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newDist)
        prev.set(edge.to, { stationId: current, line: edge.line })
      }
    }
  }

  // Reconstruct path
  const path: { stationId: string; line: string }[] = []
  let cur: string | null = toStation.id
  while (cur) {
    const p: { stationId: string; line: string } | null | undefined = prev.get(cur)
    if (!p) break
    path.unshift({ stationId: cur, line: p.line })
    cur = p.stationId
  }
  if (cur) path.unshift({ stationId: cur, line: path[0]?.line ?? '1' })

  if (path.length < 2) return null

  // Build steps grouped by line
  const steps: RouteStep[] = []

  // Walk to first station
  const walkDistKm = haversine(fromLat, fromLng, fromStation.lat, fromStation.lng)
  const walkMin = Math.max(1, Math.round(walkDistKm / 0.08)) // ~5km/h
  steps.push({
    type: 'walk',
    from: { id: 'origin', name: 'Your Location', lat: fromLat, lng: fromLng, lines: [] },
    to: fromStation,
    durationMin: walkMin,
  })

  // Group consecutive stations on same line
  let segStart = 0
  for (let i = 1; i < path.length; i++) {
    if (path[i].line !== path[segStart].line || i === path.length - 1) {
      const endIdx = path[i].line !== path[segStart].line ? i - 1 : i
      const line = getLineById(path[segStart].line)
      const segStations = path
        .slice(segStart, endIdx + 1)
        .map((p) => stationMap.get(p.stationId)!)
        .filter(Boolean)

      if (segStations.length >= 2) {
        steps.push({
          type: 'ride',
          from: segStations[0],
          to: segStations[segStations.length - 1],
          line: line?.id,
          lineName: line?.name,
          lineColor: line?.color,
          stations: segStations,
          durationMin: (segStations.length - 1) * 2,
        })
      }

      if (path[i].line !== path[segStart].line && i < path.length) {
        const transferStation = stationMap.get(path[i - 1]?.stationId ?? path[i].stationId)
        if (transferStation) {
          steps.push({
            type: 'transfer',
            from: transferStation,
            to: transferStation,
            durationMin: 3,
          })
        }
        segStart = i
      } else {
        segStart = i
      }
    }
  }

  // Walk from last station to destination
  const walkDistKm2 = haversine(toStation.lat, toStation.lng, toLat, toLng)
  const walkMin2 = Math.max(1, Math.round(walkDistKm2 / 0.08))
  steps.push({
    type: 'walk',
    from: toStation,
    to: { id: 'destination', name: 'Destination', lat: toLat, lng: toLng, lines: [] },
    durationMin: walkMin2,
  })

  const totalMin = steps.reduce((s, step) => s + step.durationMin, 0)

  return { steps, totalMin, fromStation, toStation }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
