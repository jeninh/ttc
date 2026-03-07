import { useState, useCallback } from "react";
import TTCMap from "./components/TTCMap";
import SearchPanel from "./components/SearchPanel";
import DirectionsPanel from "./components/DirectionsPanel";
import AlertsPanel from "./components/AlertsPanel";
import NearbyPanel from "./components/NearbyPanel";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useAlerts } from "./hooks/useAlerts";
import { useLocation } from "./hooks/useLocation";
import { findRoute, type Route } from "./services/routing";
import type { GeoResult } from "./services/geocoding";
import type { Station } from "./data/stations";
import "./App.css";

export default function App() {
  const online = useOnlineStatus();
  const { alerts, loading: alertsLoading } = useAlerts();
  const { location: userLocation, loading: locLoading } = useLocation();

  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromCoords, setFromCoords] = useState<[number, number] | null>(null);
  const [toCoords, setToCoords] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const handleFromSelect = useCallback((r: GeoResult) => {
    setFromCoords([r.lat, r.lng]);
  }, []);

  const handleToSelect = useCallback((r: GeoResult) => {
    setToCoords([r.lat, r.lng]);
  }, []);

  const handleNavigate = useCallback(() => {
    if (!fromCoords || !toCoords) return;
    const result = findRoute(
      fromCoords[0],
      fromCoords[1],
      toCoords[0],
      toCoords[1],
    );
    setRoute(result);
    setPanelOpen(true);

    if (result) {
      try {
        localStorage.setItem("ttc-cached-route", JSON.stringify(result));
      } catch {}
    }
  }, [fromCoords, toCoords]);

  const handleStationClick = useCallback(
    (station: Station, role: "from" | "to") => {
      if (route) setRoute(null);
      if (role === "from") {
        setFromCoords([station.lat, station.lng]);
        setFromText(station.name + " Station");
      } else {
        setToCoords([station.lat, station.lng]);
        setToText(station.name + " Station");
      }
      setPanelOpen(true);
    },
    [route],
  );

  // Navigate TO a station from the nearby panel (uses current location as origin)
  const handleNearbyNavigate = useCallback(
    (station: Station) => {
      if (route) setRoute(null);
      if (userLocation) {
        setFromCoords([userLocation.lat, userLocation.lng]);
        setFromText("My Location");
      }
      setToCoords([station.lat, station.lng]);
      setToText(station.name + " Station");
      setPanelOpen(true);
    },
    [route, userLocation],
  );

  const handleClear = useCallback(() => {
    setRoute(null);
    setFromText("");
    setToText("");
    setFromCoords(null);
    setToCoords(null);
  }, []);

  const handleRestoreCachedRoute = useCallback(() => {
    try {
      const cached = localStorage.getItem("ttc-cached-route");
      if (cached) {
        setRoute(JSON.parse(cached));
        setPanelOpen(true);
      }
    } catch {}
  }, []);

  const userLatLng: [number, number] | null = userLocation
    ? [userLocation.lat, userLocation.lng]
    : null;

  return (
    <div className="app">
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

      {/* Map */}
      <div className="map-container">
        <TTCMap
          route={route}
          originCoords={fromCoords}
          destCoords={toCoords}
          userLocation={userLatLng}
          onStationClick={handleStationClick}
        />
      </div>

      {/* Live rotating alerts ticker */}
      <AlertsPanel alerts={alerts} loading={alertsLoading} />

      {/* Nearby stations panel (left side) */}
      {userLocation && !route && (
        <NearbyPanel
          userLat={userLocation.lat}
          userLng={userLocation.lng}
          emulated={userLocation.emulated}
          onNavigateTo={handleNearbyNavigate}
        />
      )}

      {/* Location loading indicator */}
      {locLoading && (
        <div className="loc-loading">
          <span className="loc-loading-spinner" />
          Getting your location…
        </div>
      )}

      {/* Navigation panel */}
      <div className={`nav-panel ${panelOpen ? "open" : "collapsed"}`}>
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
                  label="To"
                  placeholder="Enter destination..."
                  value={toText}
                  onChange={setToText}
                  onSelect={handleToSelect}
                />
                <button
                  className="navigate-btn"
                  onClick={handleNavigate}
                  disabled={!fromCoords || !toCoords}
                >
                  Navigate
                </button>
              </div>
            ) : (
              <DirectionsPanel route={route} onClose={handleClear} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
