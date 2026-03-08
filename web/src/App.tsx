import { useState, useCallback } from 'react'
import TTCMap from './components/TTCMap'
import SearchPanel from './components/SearchPanel'
import DirectionsPanel from './components/DirectionsPanel'
import AlertsPanel from './components/AlertsPanel'
import NearbyPanel from './components/NearbyPanel'
import BottomSheet from './components/BottomSheet'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useAlerts } from './hooks/useAlerts'
import { useGeminiAlerts } from './hooks/useGeminiAlerts'
import { useLocation } from './hooks/useLocation'
import { useIsMobile } from './hooks/useIsMobile'
import { findRoute, type Route } from './services/routing'
import type { GeoResult } from './services/geocoding'
import type { Station } from './data/stations'
import VoiceoverToggle from './components/VoiceoverToggle'
import './App.css'

export default function App() {
  const online = useOnlineStatus()
  const { alerts, loading: alertsLoading } = useAlerts()
  const { segments: alertSegments } = useGeminiAlerts(alerts)
  const { location: userLocation, loading: locLoading } = useLocation()
  const isMobile = useIsMobile()

  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [fromCoords, setFromCoords] = useState<[number, number] | null>(null)
  const [toCoords, setToCoords] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [isRouting, setIsRouting] = useState(false)
  const [activeTab, setActiveTab] = useState<'map' | 'navigate' | 'nearby' | 'alerts'>('map')
  const [useGemini, setUseGemini] = useState(false)

  const handleFromSelect = useCallback((r: GeoResult) => {
    setFromCoords([r.lat, r.lng])
  }, [])

  const handleToSelect = useCallback((r: GeoResult) => {
    setToCoords([r.lat, r.lng])
  }, [])

  const handleNavigate = useCallback(async () => {
    if (!fromCoords || !toCoords) return
    setIsRouting(true)
    try {
      const result = await findRoute(fromCoords[0], fromCoords[1], toCoords[0], toCoords[1], toText, useGemini, alertSegments)
      setRoute(result)
      setPanelOpen(true)

      if (result) {
        try {
          localStorage.setItem('ttc-cached-route', JSON.stringify(result))
        } catch {}
      }
    } finally {
      setIsRouting(false)
    }
  }, [fromCoords, toCoords, toText, useGemini, alertSegments])

  const handleStationClick = useCallback(
    (station: Station, role: 'from' | 'to') => {
      if (route) setRoute(null)
      if (role === 'from') {
        setFromCoords([station.lat, station.lng])
        setFromText(station.name + ' Station')
      } else {
        setToCoords([station.lat, station.lng])
        setToText(station.name + ' Station')
      }
      setPanelOpen(true)
      setActiveTab('navigate')
    },
    [route],
  )

  // Navigate TO a station from the nearby panel (uses current location as origin)
  const handleNearbyNavigate = useCallback(
    async (station: Station) => {
      if (route) setRoute(null)
      let startCoords: [number, number] | null = null
      
      if (userLocation) {
        setFromCoords([userLocation.lat, userLocation.lng])
        setFromText('My Location')
        startCoords = [userLocation.lat, userLocation.lng]
      }
      setToCoords([station.lat, station.lng])
      setToText(station.name + ' Station')
      
      if (startCoords) {
        setIsRouting(true)
        try {
          const result = await findRoute(startCoords[0], startCoords[1], station.lat, station.lng, station.name + ' Station', useGemini, alertSegments)
          setRoute(result)
          setActiveTab('navigate')
          setPanelOpen(true)
        } finally {
          setIsRouting(false)
        }
      } else {
        setActiveTab('navigate')
        setPanelOpen(true)
      }
    },
    [route, userLocation, useGemini, alertSegments],
  )

  const handleClear = useCallback(() => {
    setRoute(null)
    setFromText('')
    setToText('')
    setFromCoords(null)
    setToCoords(null)
  }, [])

  const handleRestoreCachedRoute = useCallback(() => {
    try {
      const cached = localStorage.getItem('ttc-cached-route')
      if (cached) {
        setRoute(JSON.parse(cached))
        setPanelOpen(true)
      }
    } catch {}
  }, [])

  const userLatLng: [number, number] | null = userLocation
    ? [userLocation.lat, userLocation.lng]
    : null

  return (
    <div className={`app ${isMobile ? 'app-mobile' : ''}`}>
      {/* Offline banner */}
      {!online && (
        <div className="offline-banner">
          📡 Offline Mode — Using cached data
          {!route && (
            <button onClick={handleRestoreCachedRoute} className="restore-btn">
              Load last route
            </button>
          )}
        </div>
      )}

      <VoiceoverToggle shiftRight={!!userLocation && !route} />

      {/* Location loading indicator */}
      {(locLoading || isRouting) && (
        <div className="loc-loading">
          <span className="loc-loading-spinner" />
          {isRouting ? 'Generating route & walking directions...' : 'Getting your location…'}
        </div>
      )}

      {isMobile ? (
        <>
          {/* Mobile: Map fills the space above the tab bar */}
          <div className="map-container">
            <TTCMap
              route={route}
              originCoords={fromCoords}
              destCoords={toCoords}
              userLocation={userLatLng}
              onStationClick={handleStationClick}
              alertSegments={alertSegments}
            />
          </div>

          {/* Mobile panel area above the tab bar — iOS-style bottom sheets */}
          <BottomSheet
            open={activeTab === 'navigate'}
            snaps={[0, 0.4, 0.95]}
            defaultSnap={1}
            onDismiss={() => setActiveTab('map')}
            className="mobile-panel"
          >
            <div className="mobile-panel-header">
              <h2>🚇 Navigate</h2>
              {!online && <span className="offline-chip">Offline</span>}
            </div>
            {!route ? (
              <div className="search-section">
                <SearchPanel
                  label="From"
                  placeholder="Enter starting address..."
                  value={fromText}
                  onChange={setFromText}
                  onSelect={handleFromSelect}
                />
                <SearchPanel
                  label="To"
                  placeholder="Enter destination..."
                  value={toText}
                  onChange={setToText}
                  onSelect={handleToSelect}
                />
                <label className="gemini-toggle">
                  <input
                    type="checkbox"
                    checked={useGemini}
                    onChange={(e) => setUseGemini(e.target.checked)}
                  />
                  <span>✨ AI-enhanced directions</span>
                </label>
                <button
                  className="navigate-btn"
                  onClick={handleNavigate}
                  disabled={!fromCoords || !toCoords || isRouting}
                >
                  {isRouting ? 'Routing...' : 'Navigate'}
                </button>
              </div>
            ) : (
              <DirectionsPanel route={route} onClose={handleClear} />
            )}
          </BottomSheet>

          <BottomSheet
            open={activeTab === 'nearby'}
            snaps={[0, 0.35, 0.7, 0.95]}
            defaultSnap={2}
            onDismiss={() => setActiveTab('map')}
            className="mobile-panel"
          >
            {userLocation ? (
              <NearbyPanel
                userLat={userLocation.lat}
                userLng={userLocation.lng}
                emulated={userLocation.emulated}
                onNavigateTo={handleNearbyNavigate}
                inline
              />
            ) : (
              <div className="mobile-panel-empty">
                <span>📍</span>
                <p>{locLoading ? 'Getting your location…' : 'Location not available'}</p>
              </div>
            )}
          </BottomSheet>

          <BottomSheet
            open={activeTab === 'alerts'}
            snaps={[0, 0.35, 0.7, 0.95]}
            defaultSnap={1}
            onDismiss={() => setActiveTab('map')}
            className="mobile-panel"
          >
            <AlertsPanel alerts={alerts} loading={alertsLoading} inline />
          </BottomSheet>

          {/* Mobile bottom tab bar */}
          <nav className="mobile-tab-bar">
            <button
              className={`mobile-tab ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <span className="mobile-tab-icon">🗺️</span>
              <span className="mobile-tab-label">Map</span>
            </button>
            <button
              className={`mobile-tab ${activeTab === 'navigate' ? 'active' : ''}`}
              onClick={() => { setActiveTab('navigate'); setPanelOpen(true) }}
            >
              <span className="mobile-tab-icon">🧭</span>
              <span className="mobile-tab-label">Navigate</span>
            </button>
            <button
              className={`mobile-tab ${activeTab === 'nearby' ? 'active' : ''}`}
              onClick={() => setActiveTab('nearby')}
            >
              <span className="mobile-tab-icon">📍</span>
              <span className="mobile-tab-label">Nearby</span>
            </button>
            <button
              className={`mobile-tab ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              <span className="mobile-tab-icon">⚠️</span>
              <span className="mobile-tab-label">Alerts</span>
              {alerts.length > 0 && (
                <span className="mobile-tab-badge">{alerts.length}</span>
              )}
            </button>
          </nav>
        </>
      ) : (
        <>
          {/* Desktop layout (unchanged) */}
          <div className="map-container">
            <TTCMap
              route={route}
              originCoords={fromCoords}
              destCoords={toCoords}
              userLocation={userLatLng}
              onStationClick={handleStationClick}
              alertSegments={alertSegments}
            />
          </div>

          <AlertsPanel alerts={alerts} loading={alertsLoading} />

          {userLocation && !route && (
            <NearbyPanel
              userLat={userLocation.lat}
              userLng={userLocation.lng}
              emulated={userLocation.emulated}
              onNavigateTo={handleNearbyNavigate}
            />
          )}

          <div className={`nav-panel ${panelOpen ? 'open' : 'collapsed'}`}>
            <div className="nav-handle" onClick={() => setPanelOpen(!panelOpen)}>
              <div className="handle-bar" />
            </div>

            {panelOpen && (
              <>
                <div className="nav-header">
                  <h2>🚇 TTC Navigator</h2>
                  {!online && <span className="offline-chip">Offline</span>}
                </div>

                {!route ? (
                  <div className="search-section">
                    <SearchPanel
                      label="From"
                      placeholder="Enter starting address..."
                      value={fromText}
                      onChange={setFromText}
                      onSelect={handleFromSelect}
                    />
                    <SearchPanel
                      label="To"
                      placeholder="Enter destination..."
                      value={toText}
                      onChange={setToText}
                      onSelect={handleToSelect}
                    />
                    <label className="gemini-toggle">
                      <input
                        type="checkbox"
                        checked={useGemini}
                        onChange={(e) => setUseGemini(e.target.checked)}
                      />
                      <span>✨ AI-enhanced directions</span>
                    </label>
                    <button
                      className="navigate-btn"
                      onClick={handleNavigate}
                      disabled={!fromCoords || !toCoords || isRouting}
                    >
                      {isRouting ? 'Routing...' : 'Navigate'}
                    </button>
                  </div>
                ) : (
                  <DirectionsPanel route={route} onClose={handleClear} />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
