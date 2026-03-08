import type { TTCAlert } from './alerts'
import { lines } from '../data/lines'

export type SegmentStatus = 'closed' | 'delayed' | 'diversion' | 'normal'

export interface AffectedSegment {
  lineId: string
  fromStationId: string
  toStationId: string
  status: SegmentStatus
  alertTitle: string
}

import polyline from '@mapbox/polyline'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
const CACHE_KEY = 'ttc-gemini-segments'
const CACHE_TIME_KEY = 'ttc-gemini-time'
const CACHE_TTL = 3_600_000 // 1 hour

function buildPrompt(alerts: TTCAlert[]): string {
  const lineInfo = lines.map((l) => ({
    lineId: l.id,
    name: l.name,
    stationIds: l.stationIds,
  }))

  return `You are a TTC (Toronto Transit Commission) subway alert analyzer.

Given the following subway lines and their station IDs (in order):

${JSON.stringify(lineInfo, null, 2)}

And the following active subway alerts:

${JSON.stringify(alerts, null, 2)}

Analyze these alerts and return a JSON array of affected subway segments.

Rules:
- Only return a valid JSON array, no markdown, no code fences, no explanation
- Each element must have: lineId, fromStationId, toStationId, status, alertTitle
- lineId must be one of: '1', '2', '4', '5'
- fromStationId and toStationId must be exact station IDs from the lists above
- If an alert mentions a range of stations (stopStart to stopEnd), include ALL segments between those stations
- Map alert effects: "NO_SERVICE" or closures -> "closed", "SIGNIFICANT_DELAYS" or slow downs -> "delayed", diversions/detours -> "diversion"
- alertTitle should be a brief reason from the alert title
- Only include segments that are actually affected, not the entire line unless the entire line is affected
- If you cannot determine the exact stations, use your best judgment based on the alert description`
}

function getCachedSegments(): AffectedSegment[] | null {
  try {
    const timeStr = localStorage.getItem(CACHE_TIME_KEY)
    const cached = localStorage.getItem(CACHE_KEY)
    if (timeStr && cached && Date.now() - Number(timeStr) < CACHE_TTL) {
      return JSON.parse(cached)
    }
  } catch { }
  return null
}

function cacheSegments(segments: AffectedSegment[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(segments))
    localStorage.setItem(CACHE_TIME_KEY, String(Date.now()))
  } catch { }
}

function parseGeminiResponse(text: string): AffectedSegment[] {
  // Try parsing directly first
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
  } catch { }

  // Extract JSON array from response text
  const match = text.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch { }
  }

  return []
}

export async function analyzeAlerts(alerts: TTCAlert[], forceRefresh = false): Promise<AffectedSegment[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  console.log('[Gemini] API key present:', !!apiKey)
  if (!apiKey) return []

  const subwayAlerts = alerts.filter((a) => a.routeType === 'subway')
  console.log('[Gemini] Subway alerts found:', subwayAlerts.length, subwayAlerts.map((a) => a.title))
  if (subwayAlerts.length === 0) return []

  // Check cache first (skip if forced)
  if (!forceRefresh) {
    const cached = getCachedSegments()
    if (cached) {
      console.log('[Gemini] Using cached segments:', cached.length)
      return cached
    }
  }

  console.log('[Gemini] Calling Gemini API...')
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(subwayAlerts) }] }],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[Gemini] API error:', res.status, errBody)
      throw new Error(`Gemini API error: ${res.status}`)
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log('[Gemini] Raw response:', text)
    const segments = parseGeminiResponse(text)
    console.log('[Gemini] Parsed segments:', segments.length, segments)

    cacheSegments(segments)
    return segments
  } catch (err) {
    console.warn('Gemini analysis failed:', err)
    // Fall back to any cached data regardless of TTL
    try {
      const fallback = localStorage.getItem(CACHE_KEY)
      if (fallback) return JSON.parse(fallback)
    } catch { }
    return []
  }
}

export async function generateWalkingDirections(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  destinationName: string
): Promise<{ instructions: string[]; path: [number, number][] }> {
  try {
    const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?steps=true`)
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json()
      const route = osrmData.routes?.[0]
      const steps = route?.legs?.[0]?.steps || []

      if (steps.length > 0) {
        const rawInstructions: string[] = []
        for (const s of steps) {
          const maneuverType = s.maneuver?.type || ''
          const modifier = s.maneuver?.modifier || ''
          const dist = s.distance ? Math.round(s.distance) : 0

          if (maneuverType === 'arrive') {
            rawInstructions.push(`Arrive at ${destinationName}`)
          } else if (maneuverType === 'depart') {
            rawInstructions.push(`Head ${modifier} ${s.name ? 'on ' + s.name : ''} for ${dist}m`.replace(/\s+/g, ' ').trim())
          } else {
            const action = maneuverType === 'turn' ? 'Turn' : maneuverType.charAt(0).toUpperCase() + maneuverType.slice(1)
            rawInstructions.push(`${action} ${modifier} ${s.name ? 'onto ' + s.name : ''} for ${dist}m`.replace(/\s+/g, ' ').trim())
          }
        }

        if (rawInstructions.length > 0) {
          const decodedPath = route.geometry ? polyline.decode(route.geometry as string) as [number, number][] : []
          return { instructions: rawInstructions, path: decodedPath }
        }
      }
    }
  } catch (err) {
    console.warn('OSRM fetch failed:', err)
  }

  return { instructions: [`Walk towards ${destinationName}`], path: [] }
}
