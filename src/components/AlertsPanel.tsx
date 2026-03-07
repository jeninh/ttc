import { useState, useMemo } from 'react'
import type { TTCAlert } from '../services/alerts'

interface Props {
  alerts: TTCAlert[]
  loading: boolean
}

const typeIcon: Record<string, string> = {
  subway: '🚇',
  bus: '🚌',
  streetcar: '🚋',
  elevator: '♿',
  unknown: '⚠️',
}

const severityColor: Record<string, string> = {
  Critical: '#DA291C',
  Major: '#ff6b35',
  Minor: '#ff9800',
}

export default function AlertsPanel({ alerts, loading }: Props) {
  const [selectedAlert, setSelectedAlert] = useState<TTCAlert | null>(null)
  const [paused, setPaused] = useState(false)

  // Build the marquee text: all alerts joined with a separator, duplicated for seamless loop
  const marqueeText = useMemo(() => {
    if (alerts.length === 0) return ''
    return alerts
      .map((a) => {
        const icon = typeIcon[a.routeType] ?? '⚠️'
        const sev = a.severity ? ` [${a.severity}]` : ''
        return `${icon} ${a.title}${sev}`
      })
      .join('     ◆     ')
  }, [alerts])

  if (loading || alerts.length === 0) return null

  return (
    <>
      <div
        className="ticker-container"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onClick={() => setSelectedAlert(alerts[0])}
      >
        <div className="ticker-glow" />
        <div className="ticker-marquee-wrap">
          <div
            className={`ticker-marquee ${paused ? 'ticker-marquee-paused' : ''}`}
            style={{
              animationDuration: `${Math.max(20, alerts.length * 12)}s`,
            }}
          >
            <span className="ticker-marquee-text">{marqueeText}</span>
            <span className="ticker-marquee-spacer">     ◆     </span>
            <span className="ticker-marquee-text">{marqueeText}</span>
          </div>
        </div>
      </div>

      {/* Detail popup */}
      {selectedAlert && (
        <div className="alert-overlay" onClick={() => setSelectedAlert(null)}>
          <div className="alert-popup" onClick={(e) => e.stopPropagation()}>
            <div className="alert-popup-header">
              <span className="alert-popup-icon">
                {typeIcon[selectedAlert.routeType] ?? '⚠️'}
              </span>
              <h3>Service Alert</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedAlert(null)}
              >
                ✕
              </button>
            </div>

            <div className="alert-popup-body">
              <div className="alert-meta">
                {selectedAlert.severity && (
                  <span
                    className="severity-badge"
                    style={{
                      background:
                        severityColor[selectedAlert.severity] ?? '#888',
                    }}
                  >
                    {selectedAlert.severity}
                  </span>
                )}
                {selectedAlert.effect && (
                  <span className="effect-badge">{selectedAlert.effect}</span>
                )}
                {selectedAlert.alertType && (
                  <span className="type-badge">{selectedAlert.alertType}</span>
                )}
                <span className="type-badge">
                  {selectedAlert.routeType.charAt(0).toUpperCase() +
                    selectedAlert.routeType.slice(1)}
                </span>
              </div>

              <p className="alert-popup-title">{selectedAlert.title}</p>

              {selectedAlert.stopStart && selectedAlert.stopEnd && (
                <div className="alert-popup-route">
                  <span className="alert-popup-route-label">Affected:</span>
                  <span>
                    {selectedAlert.stopStart} → {selectedAlert.stopEnd}
                  </span>
                  {selectedAlert.direction && (
                    <span className="alert-popup-dir">
                      ({selectedAlert.direction})
                    </span>
                  )}
                </div>
              )}

              {selectedAlert.cause && (
                <div className="alert-popup-field">
                  <span className="alert-popup-field-label">Cause:</span>
                  {selectedAlert.cause}
                </div>
              )}

              {selectedAlert.description && (
                <div className="alert-popup-field">
                  <span className="alert-popup-field-label">Details:</span>
                  {selectedAlert.description}
                </div>
              )}

              <div className="alert-popup-time">
                Updated:{' '}
                {new Date(selectedAlert.lastUpdated).toLocaleString()}
              </div>
            </div>

            {/* Navigation arrows to browse alerts inside popup */}
            <div className="alert-popup-nav">
              <button
                onClick={() => {
                  const newIdx =
                    (alerts.indexOf(selectedAlert) - 1 + alerts.length) %
                    alerts.length
                  setSelectedAlert(alerts[newIdx])
                }}
              >
                ← Prev
              </button>
              <span>
                {alerts.indexOf(selectedAlert) + 1} of {alerts.length}
              </span>
              <button
                onClick={() => {
                  const newIdx =
                    (alerts.indexOf(selectedAlert) + 1) % alerts.length
                  setSelectedAlert(alerts[newIdx])
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
