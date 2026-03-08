import { graph, getLineById, type GraphEdge } from '../data/lines'
import { stationMap, type Station } from '../data/stations'

export interface RouteStep {
  type: 'walk' | 'ride' | 'transfer'
  from: Station
  to: Station
  line?: string
  lineName?: string
  lineColor?: string
  stations?: Station[]
  durationMin: number
  instructions?: string[]
}

export interface Route {
  steps: RouteStep[]
  totalMin: number
  fromStation: Station
  toStation: Station
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

async function generateWalkingDirections(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  destName: string,
  apiKey: string
): Promise<string[]> {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?steps=true`)
    if (res.ok) {
      const data = await res.json()
      const steps = data.routes?.[0]?.legs?.[0]?.steps || []
      if (steps.length > 0) {
        const instr: string[] = []
        for (const s of steps) {
          const mt = s.maneuver?.type || ''
          const mod = s.maneuver?.modifier || ''
          const dist = s.distance ? Math.round(s.distance) : 0
          if (mt === 'arrive') instr.push(`Arrive at ${destName}`)
          else if (mt === 'depart') instr.push(`Head ${mod} ${s.name ? 'on ' + s.name : ''} for ${dist}m`.replace(/\s+/g, ' ').trim())
          else {
            const action = mt === 'turn' ? 'Turn' : mt.charAt(0).toUpperCase() + mt.slice(1)
            instr.push(`${action} ${mod} ${s.name ? 'onto ' + s.name : ''} for ${dist}m`.replace(/\s+/g, ' ').trim())
          }
        }
        if (instr.length > 0) return instr
      }
    }
  } catch {}

  // Fallback to Gemini
  if (!apiKey) return [`Walk towards ${destName}`]
  try {
    const prompt = `Give 3-4 concise walking directions from coordinates (${fromLat.toFixed(4)}, ${fromLng.toFixed(4)}) to "${destName}" near (${toLat.toFixed(4)}, ${toLng.toFixed(4)}) in Toronto. Return ONLY a JSON array of strings, no markdown.`
    const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    if (r.ok) {
      const d = await r.json()
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) return JSON.parse(match[0])
    }
  } catch {}
  return [`Walk towards ${destName}`]
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function findNearest(lat: number, lng: number): Station | null {
  const all = Array.from(stationMap.values())
  if (all.length === 0) return null
  return all.reduce((best, s) => {
    const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2
    const bd = (best.lat - lat) ** 2 + (best.lng - lng) ** 2
    return d < bd ? s : best
  })
}

export async function findRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  destName: string,
  apiKey: string
): Promise<Route | null> {
  const fromStation = findNearest(fromLat, fromLng)
  const toStation = findNearest(toLat, toLng)
  if (!fromStation || !toStation) return null

  // Dijkstra's
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
      if (!visited.has(id) && d < minDist) { minDist = d; current = id }
    }
    if (current === null || current === toStation.id) break
    visited.add(current)
    const edges: GraphEdge[] = graph.get(current) ?? []
    for (const edge of edges) {
      const prevEntry = prev.get(current)
      const penalty = prevEntry && prevEntry.line !== edge.line ? 3 : 0
      const nd = minDist + edge.weight + penalty
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd)
        prev.set(edge.to, { stationId: current, line: edge.line })
      }
    }
  }

  // Reconstruct path
  const path: { stationId: string; line: string }[] = []
  let cur: string | null = toStation.id
  while (cur) {
    const p = prev.get(cur)
    if (!p) break
    path.unshift({ stationId: cur, line: p.line })
    cur = p.stationId
  }
  if (cur) path.unshift({ stationId: cur, line: path[0]?.line ?? '1' })
  if (path.length < 2) return null

  const [firstWalk, finalWalk] = await Promise.all([
    generateWalkingDirections(fromLat, fromLng, fromStation.lat, fromStation.lng, fromStation.name, apiKey),
    generateWalkingDirections(toStation.lat, toStation.lng, toLat, toLng, destName, apiKey),
  ])

  const steps: RouteStep[] = []
  const walkMin1 = Math.max(1, Math.round(haversine(fromLat, fromLng, fromStation.lat, fromStation.lng) / 0.08))
  steps.push({ type: 'walk', from: { id: 'origin', name: 'Your Location', lat: fromLat, lng: fromLng, lines: [] }, to: fromStation, durationMin: walkMin1, instructions: firstWalk })

  let segStart = 0
  for (let i = 1; i < path.length; i++) {
    if (path[i].line !== path[segStart].line || i === path.length - 1) {
      const endIdx = path[i].line !== path[segStart].line ? i - 1 : i
      const line = getLineById(path[segStart].line)
      const segStations = path.slice(segStart, endIdx + 1).map((p) => stationMap.get(p.stationId)!).filter(Boolean)
      if (segStations.length >= 2 && path[segStart].line !== 'transfer') {
        steps.push({
          type: 'ride',
          from: segStations[0],
          to: segStations[segStations.length - 1],
          line: path[segStart].line,
          lineName: line?.name,
          lineColor: line?.color,
          stations: segStations,
          durationMin: (segStations.length - 1) * 2,
        })
      }
      if (path[i].line !== path[segStart].line && i < path.length) {
        const transferStation = stationMap.get(path[i - 1]?.stationId ?? path[i].stationId)
        if (transferStation && path[i].line !== 'transfer') {
          steps.push({ type: 'transfer', from: transferStation, to: transferStation, durationMin: 3 })
        }
      }
      segStart = i
    }
  }

  const walkMin2 = Math.max(1, Math.round(haversine(toStation.lat, toStation.lng, toLat, toLng) / 0.08))
  steps.push({ type: 'walk', from: toStation, to: { id: 'destination', name: destName, lat: toLat, lng: toLng, lines: [] }, durationMin: walkMin2, instructions: finalWalk })

  return { steps, totalMin: steps.reduce((s, st) => s + st.durationMin, 0), fromStation, toStation }
}
