import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { stations, type Station } from '../data/stations'
import { lines, getLineCoords } from '../data/lines'
import type { Route } from '../services/routing'
import { useEffect, useRef } from 'react'

interface Props {
  route: Route | null
  originCoords: [number, number] | null
  destCoords: [number, number] | null
  userLocation: [number, number] | null
  onStationClick?: (station: Station, role: 'from' | 'to') => void
}

function MapController({ route, userLocation }: { route: Route | null; userLocation: [number, number] | null }) {
  const map = useMap()
  const hasCentered = useRef(false)

  // Center on user location once
  useEffect(() => {
    if (userLocation && !hasCentered.current) {
      map.setView(userLocation, 14, { animate: true })
      hasCentered.current = true
    }
  }, [userLocation, map])

  // Fit to route when navigating
  useEffect(() => {
    if (!route) return
    const allCoords: [number, number][] = route.steps.flatMap((s) => {
      const pts: [number, number][] = [[s.from.lat, s.from.lng], [s.to.lat, s.to.lng]]
      if (s.stations) pts.push(...s.stations.map((st) => [st.lat, st.lng] as [number, number]))
      return pts
    })
    if (allCoords.length > 1) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40] })
    }
  }, [route, map])

  return null
}

const pinIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:white"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

function StationMarker({
  station,
  onStationClick,
}: {
  station: Station
  onStationClick?: (station: Station, role: 'from' | 'to') => void
}) {
  const popupRef = useRef<L.Popup>(null)
  const isTransfer = station.lines.length > 1

  const handleNav = (role: 'from' | 'to') => {
    popupRef.current?.close()
    onStationClick?.(station, role)
  }

  return (
    <CircleMarker
      center={[station.lat, station.lng]}
      radius={isTransfer ? 7 : 5}
      pathOptions={{
        fillColor: isTransfer
          ? '#ffffff'
          : station.lines[0] === '1'
            ? '#FFCC29'
            : station.lines[0] === '2'
              ? '#00A859'
              : '#A900A9',
        fillOpacity: 1,
        color: '#333',
        weight: isTransfer ? 2.5 : 1.5,
      }}
    >
      <Popup ref={popupRef}>
        <div className="station-popup">
          <strong className="station-popup-name">{station.name}</strong>
          <div className="station-popup-lines">
            {station.lines.map((l) => {
              const lineObj = lines.find((ln) => ln.id === l)
              return (
                <span
                  key={l}
                  style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    borderRadius: 3,
                    background: lineObj?.color ?? '#888',
                    color: '#fff',
                    fontSize: 11,
                    marginRight: 4,
                  }}
                >
                  {lineObj?.name ?? `Line ${l}`}
                </span>
              )
            })}
          </div>
          <div className="station-popup-actions">
            <button
              className="station-popup-btn station-popup-btn--from"
              onClick={() => handleNav('from')}
            >
              Navigate from here
            </button>
            <button
              className="station-popup-btn station-popup-btn--to"
              onClick={() => handleNav('to')}
            >
              Navigate to here
            </button>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  )
}

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 0 0 2px rgba(66,133,244,.3),0 2px 6px rgba(0,0,0,.3)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

export default function TTCMap({ route, originCoords, destCoords, userLocation, onStationClick }: Props) {
  return (
    <MapContainer
      center={[43.6532, -79.3832]}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Draw subway lines */}
      {lines.map((line) =>
        getLineCoords(line).map((coords, i) => (
          <Polyline
            key={`${line.id}-${i}`}
            positions={coords}
            pathOptions={{ color: line.color, weight: 5, opacity: 0.85 }}
          />
        )),
      )}

      {/* Draw stations */}
      {stations.map((station) => (
        <StationMarker
          key={station.id}
          station={station}
          onStationClick={onStationClick}
        />
      ))}

      {/* Route overlay */}
      {route &&
        route.steps
          .filter((s) => s.type === 'ride' && s.stations)
          .map((step, i) => (
            <Polyline
              key={`route-${i}`}
              positions={step.stations!.map((s) => [s.lat, s.lng] as [number, number])}
              pathOptions={{ color: step.lineColor ?? '#DA291C', weight: 8, opacity: 1 }}
            />
          ))}

      {/* Origin & destination markers */}
      {originCoords && (
        <Marker position={originCoords} icon={pinIcon('#2196F3')}>
          <Popup>Start</Popup>
        </Marker>
      )}
      {destCoords && (
        <Marker position={destCoords} icon={pinIcon('#DA291C')}>
          <Popup>Destination</Popup>
        </Marker>
      )}

      {/* User location */}
      {userLocation && (
        <Marker position={userLocation} icon={userIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      <MapController route={route} userLocation={userLocation} />
    </MapContainer>
  )
}
