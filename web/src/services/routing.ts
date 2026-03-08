import { graph as subwayGraph, getLineById, type GraphEdge } from '../data/lines'
import { stationMap, type Station } from '../data/stations'
import { fetchStreetcarRoutes, buildStreetcarGraphEdges } from './streetcars'
import { generateWalkingDirections } from './gemini'

export interface RouteStep {
  type: 'walk' | 'ride' | 'transfer'
  from: Station
  to: Station
  line?: string
  lineName?: string
  lineColor?: string
  stations?: Station[] // intermediate stations
  durationMin: number
  instructions?: string[] // Gemini turn-by-turn walking instructions
  path?: [number, number][] // OSRM true geographic path for walks
}

export interface Route {
  steps: RouteStep[]
  totalMin: number
  fromStation: Station
  toStation: Station
}

export async function findRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  destinationName: string = 'Destination'
): Promise<Route | null> {
  console.log(`[findRoute] Executing route finding logic from [${fromLat}, ${fromLng}] to [${toLat}, ${toLng}]`)
  // Build a unified snapshot of the graph (Subways + Streetcars)
  const unifiedGraph = new Map<string, GraphEdge[]>()
  const unifiedStationMap = new Map<string, Station>(stationMap)

  // Copy static subway graph
  for (const [id, edges] of subwayGraph.entries()) {
    unifiedGraph.set(id, [...edges])
  }

  // Inject dynamic streetcar routes
  console.log(`[findRoute] Fetching streetcars`)
  const streetcars = await fetchStreetcarRoutes()
  console.log(`[findRoute] Fetched ${streetcars.length} streetcars`)
  buildStreetcarGraphEdges(streetcars, unifiedGraph, unifiedStationMap)
  console.log(`[findRoute] Graph edges appended. Total unified stations: ${unifiedStationMap.size}`)

  // Find nearest transit stops (subway or streetcar)
  const allUnifiedStations = Array.from(unifiedStationMap.values())
  const fromCandidates = findNearestStationFromList(fromLat, fromLng, allUnifiedStations)
  const toCandidates = findNearestStationFromList(toLat, toLng, allUnifiedStations)
  
  const fromStation = fromCandidates[0]
  const toStation = toCandidates[0]

  console.log(`[findRoute] Candidates resolved: START=${fromStation?.name} (${fromStation?.id}) END=${toStation?.name} (${toStation?.id})`)

  if (!fromStation || !toStation) {
    console.error(`[findRoute] Null return - failed to find closest valid station`)
    return null
  }

  if (fromStation.id === toStation.id) {
    console.log(`[findRoute] Returning early. It's the same station! Generating walk steps.`)
    const walkRes = await generateWalkingDirections(fromLat, fromLng, toLat, toLng, destinationName)
    return {
      steps: [
        {
          type: 'walk',
          from: fromStation,
          to: toStation,
          durationMin: Math.max(1, Math.round(haversine(fromLat, fromLng, toLat, toLng) / 0.08)),
          instructions: walkRes.instructions,
          path: walkRes.path,
        },
      ],
      totalMin: Math.max(1, Math.round(haversine(fromLat, fromLng, toLat, toLng) / 0.08)),
      fromStation,
      toStation,
    }
  }

  // Dijkstra's algorithm
  const dist = new Map<string, number>()
  const prev = new Map<string, { stationId: string; line: string } | null>()
  const visited = new Set<string>()

  for (const [id] of unifiedGraph) {
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

    const edges = unifiedGraph.get(current) ?? []
    for (const edge of edges) {
      const prevEntry = prev.get(current)
      // Add penalty when switching lines (subway to streetcar, etc.)
      const transferPenalty = prevEntry && prevEntry.line !== edge.line ? 3 : 0
      const newDist = minDist + edge.weight + transferPenalty
      if (newDist < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newDist)
        prev.set(edge.to, { stationId: current, line: edge.line })
      }
    }
  }

  console.log(`[findRoute] Dijkstra complete. ToStation.id=${toStation.id}`)

  // Reconstruct path
  const path: { stationId: string; line: string }[] = []
  let cur: string | null = toStation.id
  while (cur) {
    const p: { stationId: string; line: string } | null | undefined = prev.get(cur)
    if (!p) break
    path.unshift({ stationId: cur, line: p.line })
    cur = p.stationId
  }
  
  if (cur) {
    path.unshift({ stationId: cur, line: path[0]?.line ?? '1' })
  } else {
    // This happens if we hit a node with no predecessor BEFORE reaching the start node.
    console.log(`[findRoute] Reconstructed path hit a break point at Node=${path.length > 0 ? path[0].stationId : 'Unknown'}. Length=${path.length}. Missing connection to start?`)
  }

  if (path.length < 2) {
    console.error(`[findRoute] Null return - Path length < 2. Path:`, path)
    return null
  }

  console.log(`[findRoute] Path successfully reconstructed w/ ${path.length} station stops. Generating steps in parallel.`)

  // Build steps grouped by line
  const steps: RouteStep[] = []

  // Generate walk instructions in parallel
  const [firstWalkRes, finalWalkRes] = await Promise.all([
    generateWalkingDirections(fromLat, fromLng, fromStation.lat, fromStation.lng, fromStation.name),
    generateWalkingDirections(toStation.lat, toStation.lng, toLat, toLng, destinationName)
  ])

  // Walk to first station
  const walkDistKm = haversine(fromLat, fromLng, fromStation.lat, fromStation.lng)
  const walkMin = Math.max(1, Math.round(walkDistKm / 0.08)) // ~5km/h
  steps.push({
    type: 'walk',
    from: { id: 'origin', name: 'Your Location', lat: fromLat, lng: fromLng, lines: [] },
    to: fromStation,
    durationMin: walkMin,
    instructions: firstWalkRes.instructions,
    path: firstWalkRes.path
  })

  // Group consecutive stations on same line
  let segStart = 0
  for (let i = 1; i < path.length; i++) {
    if (path[i].line !== path[segStart].line || i === path.length - 1) {
      const endIdx = path[i].line !== path[segStart].line ? i - 1 : i
      let line = getLineById(path[segStart].line)
      
      // Check if it's a streetcar route
      let lineColor = line?.color
      let lineName = line?.name
      if (!line) {
        const sc = streetcars.find(s => s.routeId === path[segStart].line)
        if (sc) {
          lineColor = sc.color
          lineName = sc.title
        }
      }

      const segStations = path
        .slice(segStart, endIdx + 1)
        .map((p) => unifiedStationMap.get(p.stationId)!)
        .filter(Boolean)

      if (segStations.length >= 2 && path[segStart].line !== 'transfer') {
        steps.push({
          type: 'ride',
          from: segStations[0],
          to: segStations[segStations.length - 1],
          line: path[segStart].line,
          lineName: lineName,
          lineColor: lineColor,
          stations: segStations,
          durationMin: (segStations.length - 1) * 2,
        })
      }

      if (path[i].line !== path[segStart].line && i < path.length) {
        const transferStation = unifiedStationMap.get(path[i - 1]?.stationId ?? path[i].stationId)
        if (transferStation && path[i].line !== 'transfer') {
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
  const finalWalkDistKm = haversine(toStation.lat, toStation.lng, toLat, toLng)
  steps.push({
    type: 'walk',
    from: toStation,
    to: { id: 'destination', name: destinationName, lat: toLat, lng: toLng, lines: [] },
    durationMin: Math.max(1, Math.round(finalWalkDistKm / 0.08)),
    instructions: finalWalkRes.instructions,
    path: finalWalkRes.path
  })

  const totalMin = steps.reduce((sum, s) => sum + s.durationMin, 0)

  return { steps, totalMin, fromStation, toStation }
}

function findNearestStationFromList(lat: number, lng: number, list: Station[]): Station[] {
  return list
    .map((s) => ({ station: s, distSq: (s.lat - lat) ** 2 + (s.lng - lng) ** 2 }))
    .sort((a, b) => a.distSq - b.distSq)
    .map(x => x.station)
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
