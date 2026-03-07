export interface GeoResult {
  lat: number
  lng: number
  displayName: string
}

export async function geocode(query: string): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Toronto, ON')}&format=json&limit=5&viewbox=-79.65,43.86,-79.10,43.58&bounded=1`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'TTCNavigator/1.0' },
  })
  if (!res.ok) return []

  const data = await res.json()
  return data.map((item: any) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
  }))
}
