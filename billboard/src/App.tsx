import { useState, useEffect } from 'react'
import SearchInput from './components/SearchInput'
import RouteResult from './components/RouteResult'
import type { GeoResult } from './services/geocoding'
import { findRoute, type Route } from './services/routing'
import { fetchAlerts, type TTCAlert } from './services/alerts'
import { stations } from './data/stations'
import './index.css'

const THE_WELL_LOC = { lat: 43.6436, lng: -79.3956, displayName: 'The Well' }
const BILLBOARD_LOC = { lat: 43.6565, lng: -79.3806 } // Dundas Station

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isAlertWithinRadius(alert: TTCAlert, centerLat: number, centerLng: number, radiusKm: number): boolean {
  const textToSearch = `${alert.title} ${alert.description} ${alert.route} ${alert.stopStart} ${alert.stopEnd}`.toLowerCase()
  for (const station of stations) {
    if (textToSearch.includes(station.name.toLowerCase())) {
      if (haversine(centerLat, centerLng, station.lat, station.lng) <= radiusKm) {
        return true
      }
    }
  }
  return false
}

export default function App() {
  const [isTestingMode, setIsTestingMode] = useState(false)

  // Starting location setup
  // Defaults to "The Well" if not in testing mode
  const [fromLabel, setFromLabel] = useState('The Well')
  const [fromGeo, setFromGeo] = useState<GeoResult | null>(THE_WELL_LOC)

  const [toLabel, setToLabel] = useState('')
  const [toGeo, setToGeo] = useState<GeoResult | null>(null)

  const [route, setRoute] = useState<Route | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  
  const [alerts, setAlerts] = useState<TTCAlert[]>([])
  const [localAlerts, setLocalAlerts] = useState<TTCAlert[]>([])
  const [activeAlertIndex, setActiveAlertIndex] = useState(0)

  // Rotate alerts
  useEffect(() => {
    fetchAlerts().then(a => {
      setAlerts(a.filter(alert => alert.severity === 'Major' || alert.severity === 'Critical'))
      setLocalAlerts(a.filter(alert => isAlertWithinRadius(alert, isTestingMode ? BILLBOARD_LOC.lat : THE_WELL_LOC.lat, isTestingMode ? BILLBOARD_LOC.lng : THE_WELL_LOC.lng, 3)))
    })
    const interval = setInterval(() => {
      setActiveAlertIndex(current => (current + 1) % (alerts.length || 1))
    }, 5000)
    return () => clearInterval(interval)
  }, [alerts.length, isTestingMode])

  const handleSearch = async () => {
    if (!fromGeo || !toGeo) return
    setLoadingRoute(true)
    // We assume the user has set the GEMINI API in env, or it uses fallback
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
    
    // Slight delay to show loading animation
    await new Promise(r => setTimeout(r, 800))
    
    const r = await findRoute(
      fromGeo.lat, fromGeo.lng,
      toGeo.lat, toGeo.lng,
      toLabel,
      apiKey
    )
    setRoute(r)
    setLoadingRoute(false)
  }

  return (
    <div className="billboard-container">
      {/* Dynamic Background Pattern */}
      <div className="bg-pattern" />

      {/* Top Bar for Billboard branding */}
      <header className="billboard-header">
        <div className="logo-area">
          <span className="logo-icon">🚇</span>
          <h1>TTC Wayfinder</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Testing Mode Toggle */}
          <button 
            className={`testing-toggle ${isTestingMode ? 'active' : ''}`}
            onClick={() => {
              const newMode = !isTestingMode;
              setIsTestingMode(newMode);
              if (!newMode) {
                setFromLabel('The Well');
                setFromGeo(THE_WELL_LOC);
              } else {
                setFromLabel('');
                setFromGeo(null);
              }
            }}
          >
            🧪 Testing Mode {isTestingMode ? 'ON' : 'OFF'}
          </button>
          <div className="time-display">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      {/* Alerts Ticker */}
      {alerts.length > 0 && (
        <div className="alerts-ticker">
          <div className="alert-badge">⚠️ Service Alert</div>
          <div className="alert-content">
            <span className="alert-title">{alerts[activeAlertIndex]?.title}</span>
            <span className="alert-desc">{alerts[activeAlertIndex]?.description}</span>
          </div>
        </div>
      )}

      {/* Local Closures Side Panel */}
      {localAlerts.length > 0 && (
        <div className="closures-sidepanel">
          <h3>🚧 Local Closures (3km)</h3>
          <div className="closures-list">
            {localAlerts.map(alert => (
              <div key={alert.id} className="local-alert-card">
                <h4>{alert.title}</h4>
                <p>{alert.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {!route ? (
          <div className="search-section">
            <h2 className="headline">Where would you like to go?</h2>
            
            <div className="search-bar-glass">
              {isTestingMode ? (
                <>
                  <SearchInput
                    id="search-from"
                    icon="📍"
                    placeholder="Starting location or station..."
                    value={fromLabel}
                    onChange={setFromLabel}
                    onSelect={(geo) => setFromGeo(geo)}
                    accent="var(--ttc-blue)"
                  />
                  <div className="search-divider" />
                </>
              ) : (
                <div className="fixed-origin">
                  <span className="origin-icon">📍</span>
                  <div className="origin-text">
                    <span className="origin-label">Current Location</span>
                    <strong>The Well</strong>
                  </div>
                  <div className="search-divider" />
                </div>
              )}
              
              <SearchInput
                id="search-to"
                icon="🎯"
                placeholder="Destination or station..."
                value={toLabel}
                onChange={setToLabel}
                onSelect={(geo) => setToGeo(geo)}
                accent="var(--ttc-red)"
              />

              <button 
                className={`go-button ${fromGeo && toGeo ? 'ready' : ''} ${loadingRoute ? 'loading' : ''}`}
                onClick={handleSearch}
                disabled={!fromGeo || !toGeo || loadingRoute}
              >
                {loadingRoute ? <span className="spinner" /> : 'Get Directions'}
              </button>
            </div>
            
            {!fromGeo && !toGeo && (
              <div className="quick-suggestions">
                <span className="suggestion-label">Popular Destinations:</span>
                <button className="suggestion-chip" onClick={() => {
                  setToLabel('Union Station')
                  setToGeo({ lat: 43.6455, lng: -79.3807, displayName: 'Union Station' })
                }}>Union Station</button>
                <button className="suggestion-chip" onClick={() => {
                  setToLabel("Queen's Park")
                  setToGeo({ lat: 43.6600, lng: -79.3905, displayName: "Queen's Park" })
                }}>Queen's Park</button>
                <button className="suggestion-chip" onClick={() => {
                  setToLabel('Yorkdale Mall')
                  setToGeo({ lat: 43.7250, lng: -79.4457, displayName: 'Yorkdale Mall' })
                }}>Yorkdale Mall</button>
              </div>
            )}
          </div>
        ) : (
          <div className="route-section">
            <div className="route-container-glass">
              <button 
                className="back-button"
                onClick={() => {
                  setRoute(null)
                  if (!isTestingMode) {
                    setFromLabel('The Well')
                    setFromGeo(THE_WELL_LOC)
                  } else {
                    setFromLabel('')
                    setFromGeo(null)
                  }
                  setToLabel('')
                }}
              >
                ← Plan another trip
              </button>
              <RouteResult route={route} onClose={() => setRoute(null)} />
            </div>
          </div>
        )}
      </main>
      
      {/* Footer Instructions */}
      <footer className="billboard-footer">
        <p>Touch the screen to interact · Voice commands coming soon</p>
      </footer>
    </div>
  )
}
