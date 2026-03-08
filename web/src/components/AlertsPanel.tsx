import { useState } from 'react'
import type { TTCAlert } from '../services/alerts'
import { useAudio } from '../contexts/AudioContext'

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
  const [collapsed, setCollapsed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { playText, stopAudio, isPlaying, isLoading } = useAudio()

  if (loading || alerts.length === 0) return null

  return (
    <div className={`alerts-panel ${collapsed ? 'alerts-panel-collapsed' : ''}`}>
      <div className="alerts-panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="alerts-panel-title" style={{ display: 'flex', alignItems: 'center' }}>
          ⚠️ Service Alerts
          <span className="alerts-panel-count">{alerts.length}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isPlaying || isLoading) {
                stopAudio()
              } else {
                const script = `There are ${alerts.length} active service alerts. ` + 
                  alerts.map((a, i) => `Alert ${i + 1}: ${a.title}. ${a.description ? a.description : ''}`).join(' ')
                playText(script)
              }
            }}
            style={{
              marginLeft: '12px',
              padding: '2px 8px',
              background: isPlaying || isLoading ? 'white' : 'transparent',
              color: isPlaying || isLoading ? 'var(--ttc-red)' : 'inherit',
              border: '1px solid currentColor',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            {isLoading ? '⏳' : isPlaying ? '⏹' : '🔊 Read'}
          </button>
        </span>
        <span className="alerts-panel-toggle">{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <div className="alerts-panel-list">
          {alerts.map((alert) => {
            const expanded = expandedId === alert.id
            return (
              <div
                key={alert.id}
                className="alerts-panel-card"
                onClick={() => setExpandedId(expanded ? null : alert.id)}
              >
                <div className="alerts-panel-card-top">
                  <span className="alerts-panel-card-icon">
                    {typeIcon[alert.routeType] ?? '⚠️'}
                  </span>
                  <div className="alerts-panel-card-info">
                    <div className="alerts-panel-card-meta">
                      {alert.severity && (
                        <span
                          className="severity-badge"
                          style={{ background: severityColor[alert.severity] ?? '#888' }}
                        >
                          {alert.severity}
                        </span>
                      )}
                      {alert.effect && (
                        <span className="effect-badge">{alert.effect}</span>
                      )}
                      <span className="type-badge">
                        {alert.routeType.charAt(0).toUpperCase() + alert.routeType.slice(1)}
                      </span>
                    </div>
                    <p className="alerts-panel-card-title">{alert.title}</p>
                  </div>
                </div>

                {expanded && (
                  <div className="alerts-panel-card-details">
                    {alert.stopStart && alert.stopEnd && (
                      <div className="alert-popup-route">
                        <span className="alert-popup-route-label">Affected:</span>
                        <span>{alert.stopStart} → {alert.stopEnd}</span>
                        {alert.direction && (
                          <span className="alert-popup-dir">({alert.direction})</span>
                        )}
                      </div>
                    )}
                    {alert.cause && (
                      <div className="alert-popup-field">
                        <span className="alert-popup-field-label">Cause: </span>
                        {alert.cause}
                      </div>
                    )}
                    {alert.description && (
                      <div className="alert-popup-field">
                        <span className="alert-popup-field-label">Details: </span>
                        {alert.description}
                      </div>
                    )}
                    <div className="alert-popup-time">
                      Updated: {new Date(alert.lastUpdated).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
