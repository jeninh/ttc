export interface GeoResult {
  lat: number
  lng: number
  displayName: string
}

// Photon (Komoot) — free, no API key, OSM-based autocomplete with landmarks & POIs
const PHOTON_URL = 'https://photon.komoot.io/api/'

// Bias results toward Toronto
const TORONTO_LAT = 43.6532
const TORONTO_LNG = -79.3832

export async function geocode(query: string): Promise<GeoResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      lat: String(TORONTO_LAT),
      lon: String(TORONTO_LNG),
      limit: '6',
      lang: 'en',
    })

    const res = await fetch(`${PHOTON_URL}?${params}`)
    if (!res.ok) return []

    const data = await res.json()
    return (data.features ?? []).map((f: any) => {
      const props = f.properties ?? {}
      const coords = f.geometry?.coordinates ?? []
      const parts = [props.name, props.street, props.city, props.state].filter(Boolean)
      return {
        lat: coords[1],
        lng: coords[0],
        displayName: parts.join(', ') || props.label || query,
      }
    })
  } catch (err) {
    console.error('Geocoding fetch error:', err)
    return []
  }
}
