export interface GeoResult {
  lat: number
  lng: number
  displayName: string
}

export async function geocode(query: string): Promise<GeoResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Toronto, ON')}&format=json&limit=5&viewbox=-79.65,43.86,-79.10,43.58&bounded=1&email=ttc-navigator-local@example.com`

    const res = await fetch(url)
    if (!res.ok) return []

    const data = await res.json()
    return data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
    }))
  } catch (err) {
    console.error('Geocoding fetch error:', err)
    return []
  }
}
