const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM' // Default voice 'Rachel'

export async function fetchAudioStream(text: string): Promise<Blob | null> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_ELEVENLABS_API_KEY in .env file. Please add it and restart the server.')
  }

  const res = await fetch(ELEVENLABS_URL, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5', // Fastest model for responsive UI
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  })

  if (!res.ok) {
    // Fallback to monolingual v1 if flash v2.5 is not available on this tier
    if (res.status === 400) {
      const fallbackRes = await fetch(ELEVENLABS_URL, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      })
      if (fallbackRes.ok) return await fallbackRes.blob()
    }
  }

  return await res.blob()
}
