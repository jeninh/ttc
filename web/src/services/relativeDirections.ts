import type { Route } from './routing'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby'

interface NearbyLandmark {
  name: string
  lat: number
  lng: number
  type: string
}

async function fetchLandmarksAlongRoute(route: Route, googleMapsKey: string): Promise<NearbyLandmark[]> {
  // Collect key waypoints: walk start/end points and station locations
  const waypoints: { lat: number; lng: number }[] = []
  for (const step of route.steps) {
    if (step.type === 'walk') {
      waypoints.push({ lat: step.from.lat, lng: step.from.lng })
      waypoints.push({ lat: step.to.lat, lng: step.to.lng })
    }
  }

  if (waypoints.length === 0) return []

  // Search for landmarks near each walking waypoint
  const landmarks: NearbyLandmark[] = []
  const seen = new Set<string>()

  for (const wp of waypoints) {
    try {
      const res = await fetch(PLACES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleMapsKey,
          'X-Goog-FieldMask': 'places.displayName,places.location,places.primaryType',
        },
        body: JSON.stringify({
          includedTypes: [
            'restaurant', 'cafe', 'gas_station', 'bank', 'pharmacy',
            'convenience_store', 'supermarket', 'park', 'church',
            'school', 'library', 'hospital', 'shopping_mall',
          ],
          maxResultCount: 5,
          locationRestriction: {
            circle: {
              center: { latitude: wp.lat, longitude: wp.lng },
              radius: 200,
            },
          },
        }),
      })

      if (!res.ok) continue

      const data = await res.json()
      for (const place of data.places ?? []) {
        const name = place.displayName?.text
        if (!name || seen.has(name)) continue
        seen.add(name)
        landmarks.push({
          name,
          lat: place.location?.latitude ?? wp.lat,
          lng: place.location?.longitude ?? wp.lng,
          type: place.primaryType ?? 'landmark',
        })
      }
    } catch {
      // continue with other waypoints
    }
  }

  return landmarks
}

function buildPrompt(route: Route, landmarks: NearbyLandmark[]): string {
  const stepsDesc = route.steps.map((s, i) => {
    if (s.type === 'walk') {
      return `Step ${i + 1}: Walk from "${s.from.name}" (${s.from.lat},${s.from.lng}) to "${s.to.name}" (${s.to.lat},${s.to.lng}) — ${s.durationMin} min`
    }
    if (s.type === 'ride') {
      return `Step ${i + 1}: Take ${s.lineName} from "${s.from.name}" to "${s.to.name}" — ${s.durationMin} min (${s.stations?.length ?? 0} stops)`
    }
    return `Step ${i + 1}: Transfer at "${s.from.name}" — ${s.durationMin} min`
  })

  return `You are a friendly Toronto local giving walking and transit directions to someone unfamiliar with the area.

Here is the route:
${stepsDesc.join('\n')}

Here are real landmarks/businesses near the walking portions of the route:
${JSON.stringify(landmarks, null, 2)}

Generate natural, human-friendly directions using these landmarks as reference points. For walking portions:
- Use phrases like "Walk about x blocks to the right until you see the [Landmark Name]"
- Reference real landmarks like "You'll pass [Business Name] on your left"  
- Use street-level cues like "Turn left at the [Landmark Name] on the corner"
- Use left/right direction over absolute direction whenever possible

For transit portions:
- Say which line to take and which direction
- Mention how many stops
- Say what to look for when getting off

Keep it concise but natural — like a friend giving directions, BUT don't be too nice. Use bullet points.
Return ONLY the directions text, no JSON, no markdown code fences.`
}

export async function getRelativeDirections(route: Route): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY

  if (!apiKey) return 'Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.'

  // Fetch landmarks using the same API key (enable Places API on the same GCP project)
  const landmarks = await fetchLandmarksAlongRoute(route, apiKey)

  const prompt = buildPrompt(route, landmarks)

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error('[RelativeDirections] Gemini error:', res.status, errBody)
    throw new Error(`Gemini API error: ${res.status}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Could not generate directions.'
}
