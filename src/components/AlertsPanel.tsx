import { useState } from "react";
import type { TTCAlert } from "../services/alerts";

interface Props {
  alerts: TTCAlert[];
  loading: boolean;
}

const typeIcon: Record<string, string> = {
  subway: "🚇",
  bus: "🚌",
  streetcar: "🚋",
  elevator: "♿",
  unknown: "⚠️",
};

const severityColor: Record<string, string> = {
  Critical: "#DA291C",
  Major: "#ff6b35",
  Minor: "#ff9800",
};

export default function AlertsPanel({ alerts, loading }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (loading || alerts.length === 0) return null;

  const alert = alerts[currentIndex];

  return (
    <div className="alert-popup">
      <div className="alert-popup-header">
        <span className="alert-popup-icon">
          {typeIcon[alert.routeType] ?? "⚠️"}
        </span>
        <h3>Service Alert</h3>
      </div>

      <div className="alert-popup-body">
        <div className="alert-meta">
          {alert.severity && (
            <span
              className="severity-badge"
              style={{ background: severityColor[alert.severity] ?? "#888" }}
            >
              {alert.severity}
            </span>
          )}
          {alert.effect && <span className="effect-badge">{alert.effect}</span>}
          {alert.alertType && (
            <span className="type-badge">{alert.alertType}</span>
          )}
          <span className="type-badge">
            {alert.routeType.charAt(0).toUpperCase() + alert.routeType.slice(1)}
          </span>
        </div>

        <p className="alert-popup-title">{alert.title}</p>

        {alert.stopStart && alert.stopEnd && (
          <div className="alert-popup-route">
            <span className="alert-popup-route-label">Affected:</span>
            <span>
              {alert.stopStart} → {alert.stopEnd}
            </span>
            {alert.direction && (
              <span className="alert-popup-dir">({alert.direction})</span>
            )}
          </div>
        )}

        {alert.cause && (
          <div className="alert-popup-field">
            <span className="alert-popup-field-label">Cause:</span>
            {alert.cause}
          </div>
        )}

        {alert.description && (
          <div className="alert-popup-field">
            <span className="alert-popup-field-label">Details:</span>
            {alert.description}
          </div>
        )}

        <div className="alert-popup-time">
          Updated: {new Date(alert.lastUpdated).toLocaleString()}
        </div>
      </div>

      <div className="alert-popup-nav">
        <button
          onClick={() =>
            setCurrentIndex((currentIndex - 1 + alerts.length) % alerts.length)
          }
        >
          ← Prev
        </button>
        <span>
          {currentIndex + 1} of {alerts.length}
        </span>
        <button
          onClick={() => setCurrentIndex((currentIndex + 1) % alerts.length)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
