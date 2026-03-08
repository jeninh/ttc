export interface GeoResult {
  lat: number
  lng: number
  displayName: string
}

export async function geocode(query: string): Promise<GeoResult[]> {
  // Use Photon by Komoot, built on OSM but much better for POIs and fuzzy matching
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=43.6532&lon=-79.3832&limit=5`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    if (!data.features) return []
    
    return data.features.map((f: any) => {
      const p = f.properties
      let name = p.name || p.street || 'Unknown Location'
      const details = [p.street, p.city, p.state].filter(Boolean)
      if (details.length > 0 && name !== p.street) {
        name += `, ${details[0]}`
      }
      return {
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        displayName: name,
      }
    })
  } catch {
    return []
  }
}
