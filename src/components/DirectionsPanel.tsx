import type { Route } from '../services/routing'

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
  return (
    <div className="directions-panel">
      <div className="directions-header">
        <h3>
          🚇 {route.totalMin} min total
        </h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
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
                <span>
                  Walk to <strong>{step.to.name}</strong>{' '}
                  <span className="step-time">{step.durationMin} min</span>
                </span>
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
                <span>
                  Transfer at <strong>{step.from.name}</strong>{' '}
                  <span className="step-time">{step.durationMin} min</span>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="directions-note">
        ℹ️ Route cached for offline use underground
      </p>
    </div>
  )
}
