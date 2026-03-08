export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { text, model_id, voice_settings } = await req.json()

  const voiceId = '21m00Tcm4TlvDq8ikWAM'
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({ text, model_id, voice_settings }),
  })

  if (!res.ok && res.status === 400) {
    // Fallback to monolingual v1
    const fallbackRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings,
      }),
    })
    return new Response(fallbackRes.body, {
      status: fallbackRes.status,
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  }

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'audio/mpeg' },
  })
}
