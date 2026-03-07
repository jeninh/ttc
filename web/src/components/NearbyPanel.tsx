import { useMemo } from 'react'
import { findNearestStations } from '../data/stations'
import { lines } from '../data/lines'
import type { Station } from '../data/stations'

interface Props {
  userLat: number
  userLng: number
  emulated: boolean
  onNavigateTo: (station: Station) => void
}

function getNextDepartures(stationIdx: number): string[] {
  const now = new Date()
  const offsets = [
    ((stationIdx * 3 + 1) % 5) + 1,
    ((stationIdx * 3 + 1) % 5) + 4 + Math.floor(stationIdx % 3),
    ((stationIdx * 3 + 1) % 5) + 8 + Math.floor(stationIdx % 4),
  ]
  return offsets.map((o) => {
    const dep = new Date(now.getTime() + o * 60_000)
    return dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })
}

function getLineInfo(lineId: string) {
  return lines.find((l) => l.id === lineId)
}

export default function NearbyPanel({ userLat, userLng, emulated, onNavigateTo }: Props) {
  const nearby = useMemo(
    () => findNearestStations(userLat, userLng, 6),
    [userLat, userLng],
  )

  if (nearby.length === 0) return null

  const closest = nearby[0]

  return (
    <div className="nearby-sidebar">
      {/* Header */}
      <div className="nearby-sb-header">
        <h2 className="nearby-sb-title">🚇 Nearby</h2>
        <span className="nearby-sb-loc-tag">
          {emulated ? '📍 Emulated' : '📍 Live'}
        </span>
      </div>

      {/* Your location */}
      <div className="nearby-sb-location">
        <div className="nearby-sb-loc-label">Your location</div>
        <div className="nearby-sb-loc-coords">
          {userLat.toFixed(4)}°N, {Math.abs(userLng).toFixed(4)}°W
        </div>
      </div>

      {/* Closest station highlight */}
      <div className="nearby-sb-closest">
        <div className="nearby-sb-closest-label">Closest station</div>
        <div className="nearby-sb-closest-name">{closest.station.name}</div>
        <div className="nearby-sb-closest-meta">
          <span>
            {closest.distKm < 1
              ? `${Math.round(closest.distKm * 1000)}m`
              : `${closest.distKm.toFixed(1)}km`}
          </span>
          <span>🚶 {closest.walkMin} min walk</span>
        </div>
        <div className="nearby-sb-closest-lines">
          {closest.station.lines.map((l) => {
            const ln = getLineInfo(l)
            return ln ? (
              <span key={ln.id} className="nearby-sb-line-pill" style={{ background: ln.color }}>
                {ln.name}
              </span>
            ) : null
          })}
        </div>
        <button
          className="nearby-sb-nav-btn"
          onClick={() => onNavigateTo(closest.station)}
        >
          Navigate here →
        </button>
      </div>

      {/* All nearby stations with departure boards */}
      <div className="nearby-sb-list-header">All nearby stations</div>
      <div className="nearby-sb-list">
        {nearby.map((ns, i) => {
          const departures = getNextDepartures(i)
          const stationLines = ns.station.lines.map((l) => getLineInfo(l)).filter(Boolean)
          return (
            <div key={ns.station.id} className="nearby-sb-card">
              <div className="nearby-sb-card-top">
                <div className="nearby-sb-card-dots">
                  {stationLines.map((ln) => (
                    <span
                      key={ln!.id}
                      className="nearby-sb-card-dot"
                      style={{ background: ln!.color }}
                    />
                  ))}
                </div>
                <div className="nearby-sb-card-info">
                  <span className="nearby-sb-card-name">{ns.station.name}</span>
                  <span className="nearby-sb-card-dist">
                    {ns.distKm < 1
                      ? `${Math.round(ns.distKm * 1000)}m`
                      : `${ns.distKm.toFixed(1)}km`}
                    {' · 🚶 '}
                    {ns.walkMin} min
                  </span>
                </div>
              </div>

              {/* Departure board */}
              <div className="nearby-sb-deps">
                <span className="nearby-sb-deps-label">Next departures</span>
                <div className="nearby-sb-dep-times">
                  {departures.map((t, j) => (
                    <span key={j} className={`nearby-sb-dep ${j === 0 ? 'soonest' : ''}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Line badges */}
              <div className="nearby-sb-card-lines">
                {stationLines.map((ln) => (
                  <span
                    key={ln!.id}
                    className="nearby-sb-card-line-badge"
                    style={{ background: ln!.color }}
                  >
                    {ln!.name.replace('Line ', 'L')}
                  </span>
                ))}
              </div>

              <button
                className="nearby-sb-card-nav"
                onClick={() => onNavigateTo(ns.station)}
              >
                Navigate →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
