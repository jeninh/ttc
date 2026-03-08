import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { stations, stationMap, type Station } from '../data/stations'
import { lines } from '../data/lines'
import type { Route } from '../services/routing'
import type { AffectedSegment, SegmentStatus } from '../services/gemini'
import { useEffect, useRef, useState } from 'react'
import { fetchStreetcarRoutes, type StreetcarPath } from '../services/streetcars'

interface Props {
  route: Route | null
  originCoords: [number, number] | null
  destCoords: [number, number] | null
  userLocation: [number, number] | null
  onStationClick?: (station: Station, role: 'from' | 'to') => void
  alertSegments?: AffectedSegment[]
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
      if (s.type === 'walk' && s.path && s.path.length > 0) return s.path
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

const statusColor: Record<SegmentStatus, string> = {
  closed: '#DA291C',
  delayed: '#FFB300',
  diversion: '#FF6D00',
  normal: '',
}

const statusLabel: Record<SegmentStatus, string> = {
  closed: '🚫 Closed',
  delayed: '⚠️ Delayed',
  diversion: '🔀 Diversion',
  normal: '',
}

function getSegmentStatus(
  lineId: string,
  fromId: string,
  toId: string,
  alertSegments: AffectedSegment[],
): AffectedSegment | undefined {
  return alertSegments.find(
    (s) =>
      s.lineId === lineId &&
      ((s.fromStationId === fromId && s.toStationId === toId) ||
        (s.fromStationId === toId && s.toStationId === fromId)),
  )
}

function buildLineSegments(
  line: typeof lines[0],
  alertSegments: AffectedSegment[],
): { coords: [number, number][]; color: string; status: SegmentStatus; dashArray?: string; tooltip?: string }[] {
  const result: { coords: [number, number][]; color: string; status: SegmentStatus; dashArray?: string; tooltip?: string }[] = []
  let currentGroup: { coords: [number, number][]; color: string; status: SegmentStatus; dashArray?: string; tooltip?: string } | null = null

  for (let i = 0; i < line.stationIds.length - 1; i++) {
    const fromId = line.stationIds[i]
    const toId = line.stationIds[i + 1]
    const fromStation = stationMap.get(fromId)
    const toStation = stationMap.get(toId)
    if (!fromStation || !toStation) continue

    const affected = getSegmentStatus(line.id, fromId, toId, alertSegments)
    const status: SegmentStatus = affected?.status ?? 'normal'
    const color = status === 'normal' ? line.color : statusColor[status]
    const dashArray = status === 'diversion' ? '8 6' : undefined
    const tooltip = affected ? `${statusLabel[status]}: ${affected.alertTitle}` : undefined

    if (currentGroup && currentGroup.status === status && currentGroup.color === color) {
      currentGroup.coords.push([toStation.lat, toStation.lng])
      if (tooltip) currentGroup.tooltip = tooltip
    } else {
      currentGroup = {
        coords: [[fromStation.lat, fromStation.lng], [toStation.lat, toStation.lng]],
        color,
        status,
        dashArray,
        tooltip,
      }
      result.push(currentGroup)
    }
  }

  return result
}

function StatusLegend({ segments }: { segments: AffectedSegment[] }) {
  if (segments.length === 0) return null

  const hasStatus = (s: SegmentStatus) => segments.some((seg) => seg.status === s)
  const items: { status: SegmentStatus; label: string; color: string }[] = []
  if (hasStatus('closed')) items.push({ status: 'closed', label: 'Closed', color: statusColor.closed })
  if (hasStatus('delayed')) items.push({ status: 'delayed', label: 'Delayed', color: statusColor.delayed })
  if (hasStatus('diversion')) items.push({ status: 'diversion', label: 'Diversion', color: statusColor.diversion })

  if (items.length === 0) return null

  return (
    <div className="map-legend">
      <div className="map-legend-title">Service Status</div>
      {items.map((item) => (
        <div key={item.status} className="map-legend-item">
          <span
            className="map-legend-swatch"
            style={{
              background: item.color,
              borderStyle: item.status === 'diversion' ? 'dashed' : 'solid',
            }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function TTCMap({ route, originCoords, destCoords, userLocation, onStationClick, alertSegments = [] }: Props) {
  const [streetcarRoutes, setStreetcarRoutes] = useState<StreetcarPath[]>([])

  useEffect(() => {
    fetchStreetcarRoutes().then(setStreetcarRoutes)
  }, [])

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

      {/* Draw static streetcar routes as a background layer */}
      {streetcarRoutes.map((scRoute) =>
        scRoute.paths.map((pathCoords, i) => (
          <Polyline
            key={`sc-${scRoute.routeId}-${i}`}
            positions={pathCoords}
            pathOptions={{
              color: '#DA291C', // Official TTC Red
              weight: 3,
              opacity: 0.65,
            }}
          >
            <Popup>{scRoute.title}</Popup>
          </Polyline>
        ))
      )}

      {/* Draw subway lines with alert coloring */}
      {lines.map((line) =>
        buildLineSegments(line, alertSegments).map((seg, i) => (
          <Polyline
            key={`${line.id}-seg-${i}`}
            positions={seg.coords}
            pathOptions={{
              color: seg.color,
              weight: seg.status === 'normal' ? 5 : 7,
              opacity: seg.status === 'normal' ? 0.85 : 1,
              dashArray: seg.dashArray,
            }}
          >
            {seg.tooltip && <Popup>{seg.tooltip}</Popup>}
          </Polyline>
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
        route.steps.map((step, i) => {
          if (step.type === 'ride' && step.stations) {
            return (
              <Polyline
                key={`route-ride-${i}`}
                positions={step.stations.map((s) => [s.lat, s.lng] as [number, number])}
                pathOptions={{ color: step.lineColor ?? '#DA291C', weight: 8, opacity: 1 }}
              />
            )
          }
          if (step.type === 'walk') {
            const walkPositions = step.path && step.path.length > 0 
              ? step.path 
              : [[step.from.lat, step.from.lng], [step.to.lat, step.to.lng]] as [number, number][];
              
            return (
              <Polyline
                key={`route-walk-${i}`}
                positions={walkPositions}
                pathOptions={{ color: '#2196F3', weight: 6, opacity: 0.9, dashArray: '6, 8' }}
              />
            )
          }
          return null
        })}

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

      {/* Status legend */}
      <StatusLegend segments={alertSegments} />
    </MapContainer>
  )
}
