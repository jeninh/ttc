import { useState, useEffect } from 'react'

// Random points spread across Toronto for emulation
const TORONTO_SPOTS: [number, number][] = [
  [43.6544, -79.3807], // Dundas Square
  [43.6426, -79.3871], // CN Tower area
  [43.6709, -79.3857], // Bloor-Yonge
  [43.6799, -79.3449], // Pape & Danforth
  [43.7066, -79.3984], // Eglinton & Yonge
  [43.6372, -79.5357], // Kipling area
  [43.7616, -79.4111], // Sheppard-Yonge
  [43.6600, -79.4264], // Ossington & Bloor
  [43.6558, -79.4597], // Keele & Bloor
  [43.6891, -79.3013], // Main Street
  [43.7245, -79.4476], // Yorkdale
  [43.6454, -79.3740], // Distillery District
  [43.6677, -79.4100], // Koreatown
  [43.6930, -79.2893], // Victoria Park
  [43.6515, -79.4756], // Runnymede
  [43.7757, -79.3462], // Don Mills
  [43.6738, -79.3686], // Cabbagetown
  [43.6362, -79.5112], // Royal York
]

export interface UserLocation {
  lat: number
  lng: number
  emulated: boolean
}

export function useLocation(): { location: UserLocation | null; loading: boolean; error: string | null } {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const path = window.location.pathname
    const isEmulate = path === '/emulate' || path === '/test'

    if (isEmulate) {
      const spot = TORONTO_SPOTS[Math.floor(Math.random() * TORONTO_SPOTS.length)]
      // Add small jitter so it's not exactly on a landmark
      const lat = spot[0] + (Math.random() - 0.5) * 0.005
      const lng = spot[1] + (Math.random() - 0.5) * 0.005
      setLocation({ lat, lng, emulated: true })
      setLoading(false)
      return
    }

    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, emulated: false })
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }, [])

  return { location, loading, error }
}
