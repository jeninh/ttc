import { useState } from 'react'
import type { Route } from '../services/routing'
import { getRelativeDirections } from '../services/relativeDirections'

interface Props {
  route: Route
  onClose: () => void
}

const icons: Record<string, string> = {
  walk: '🚶',
  ride: '🚇',
  transfer: '🔄',
}

export default function DirectionsPanel({ route, onClose }: Props) {
  const [showText, setShowText] = useState(false)
  const [showRelative, setShowRelative] = useState(false)
  const [relativeText, setRelativeText] = useState<string | null>(null)
  const [relativeLoading, setRelativeLoading] = useState(false)
  const [relativeError, setRelativeError] = useState<string | null>(null)

  async function handleRelativeDirections() {
    if (showRelative) {
      setShowRelative(false)
      return
    }
    setRelativeLoading(true)
    setRelativeError(null)
    try {
      const text = await getRelativeDirections(route)
      setRelativeText(text)
      setShowRelative(true)
    } catch (err: any) {
      setRelativeError(err.message ?? 'Failed to generate directions')
    } finally {
      setRelativeLoading(false)
    }
  }

  const textDirections = `Directions from ${route.fromStation.name} to ${route.toStation.name} (${route.totalMin} min):\n\n` + 
    route.steps.map((step, i) => {
      if (step.type === 'walk') {
        if (step.instructions && step.instructions.length > 0) {
          let txt = `${i + 1}. ${step.instructions[0]} (${step.durationMin} min)`;
          if (step.instructions.length > 1) {
            txt += '\n    ' + step.instructions.slice(1).join('\n    ');
          }
          return txt;
        }
        return `${i + 1}. Walk to ${step.to.name} (${step.durationMin} min)`;
      }
      if (step.type === 'ride') return `${i + 1}. Ride ${step.lineName} from ${step.from.name} to ${step.to.name} (${step.durationMin} min, ${step.stations?.length ?? 0} stops)`;
      if (step.type === 'transfer') {
        const prevRide = route.steps[i - 1]?.lineName;
        const nextRide = route.steps[i + 1]?.lineName;
        if (prevRide && nextRide) {
          return `${i + 1}. Transfer from ${prevRide} to ${nextRide} at ${step.from.name} (${step.durationMin} min)`;
        }
        return `${i + 1}. Transfer at ${step.from.name} (${step.durationMin} min)`;
      }
      return '';
    }).join('\n')

  return (
    <div className="directions-panel">
      <div className="directions-header">
        <h3>
          🚇 {route.totalMin} min total
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowText(true)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📋 Text View
          </button>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {showText && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--panel-bg)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Text Directions
              <button 
                onClick={() => setShowText(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </h3>
            <textarea 
              readOnly
              value={textDirections}
              style={{
                width: '100%',
                height: '250px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontFamily: 'monospace',
                fontSize: '13px',
                resize: 'none',
                color: 'var(--text)'
              }}
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(textDirections);
                alert('Copied to clipboard!');
              }}
              style={{
                padding: '12px',
                background: 'var(--ttc-red)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Copy to Clipboard
            </button>
          </div>
        </div>
      )}
      <div className="directions-summary">
        <span className="station-badge">{route.fromStation.name}</span>
        <span className="arrow">→</span>
        <span className="station-badge">{route.toStation.name}</span>
      </div>
      <ul className="directions-steps">
        {route.steps.map((step, i) => (
          <li key={i} className={`step step-${step.type}`}>
            <span className="step-icon">{icons[step.type]}</span>
            <div className="step-content">
              {step.type === 'walk' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {step.instructions && step.instructions.length > 0 ? (
                    <>
                      <span>
                        <strong>{step.instructions[0]}</strong>{' '}
                        <span className="step-time">{step.durationMin} min</span>
                      </span>
                      {step.instructions.length > 1 && (
                        <ul style={{ margin: '4px 0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {step.instructions.slice(1).map((inst, idx) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>{inst}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <span>
                      Walk to <strong>{step.to.name}</strong>{' '}
                      <span className="step-time">{step.durationMin} min</span>
                    </span>
                  )}
                </div>
              )}
              {step.type === 'ride' && (
                <>
                  <span>
                    <span
                      className="line-badge"
                      style={{ background: step.lineColor }}
                    >
                      {step.lineName}
                    </span>
                  </span>
                  <span className="step-detail">
                    {step.from.name} → {step.to.name}
                    <span className="step-time">{step.durationMin} min</span>
                    <span className="step-stops">
                      ({step.stations?.length ?? 0} stops)
                    </span>
                  </span>
                  {step.stations && step.stations.length > 2 && (
                    <details className="intermediate-stops">
                      <summary>View stops</summary>
                      <ol>
                        {step.stations.map((s) => (
                          <li key={s.id}>{s.name}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                </>
              )}
              {step.type === 'transfer' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>
                    Transfer at <strong>{step.from.name}</strong>{' '}
                    <span className="step-time">{step.durationMin} min</span>
                  </span>
                  {route.steps[i - 1]?.lineName && route.steps[i + 1]?.lineName && (
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      From <strong>{route.steps[i - 1].lineName}</strong> to <strong>{route.steps[i + 1].lineName}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Relative Directions button */}
      <button
        className="relative-directions-btn"
        onClick={handleRelativeDirections}
        disabled={relativeLoading}
      >
        {relativeLoading ? (
          <>
            <span className="relative-spinner" />
            Generating landmark directions…
          </>
        ) : showRelative ? (
          '📍 Hide Relative Directions'
        ) : (
          '📍 Relative Directions'
        )}
      </button>

      {relativeError && (
        <p className="relative-error">⚠️ {relativeError}</p>
      )}

      {showRelative && relativeText && (
        <div className="relative-directions-content">
          {relativeText.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      <p className="directions-note">
        ℹ️ Route cached for offline use underground
      </p>
    </div>
  )
}
