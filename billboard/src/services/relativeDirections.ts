import type { Route } from './routing'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

function buildPrompt(route: Route): string {
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

Generate natural, human-friendly directions using nearby landmarks as reference points. For walking portions:
- Use phrases like "Walk about x blocks to the right until you see the [Landmark Name]"
- Reference real landmarks like "You'll pass [Business Name] on your left"
- Use street-level cues like "Turn left at the [Landmark Name] on the corner"
- ALWAYS use relative direction (left/right/up/down) over absolute direction
- Use your knowledge of Toronto to reference real nearby businesses, parks, and landmarks

For transit portions:
- Say which line to take and which direction
- Mention how many stops
- Say what to look for when getting off

Keep it concise but natural — like a friend giving directions, BUT don't be too nice. Use bullet points.
Return ONLY the directions text, no JSON, no markdown code fences.`
}

export async function getRelativeDirections(route: Route, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('Gemini API key not configured')

  const prompt = buildPrompt(route)

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
