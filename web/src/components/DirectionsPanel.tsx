import { useState } from 'react'
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
  const [showText, setShowText] = useState(false)

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
      if (step.type === 'transfer') return `${i + 1}. Transfer at ${step.from.name} (${step.durationMin} min)`;
      return '';
    }).join('\n')

  const handlePrint = async () => {
    const markdown = `# 🚇 TTC TRIP\n\n` +
      `## ${route.fromStation.name}\n` +
      `## to ${route.toStation.name}\n\n` +
      `**Duration:** ${route.totalMin} min\n` +
      `---\n\n` +
      route.steps.map((step, i) => {
        let text = "";
        if (step.type === 'walk') {
          if (step.instructions && step.instructions.length > 0) {
            text = `### ${i + 1}. Walk\n${step.instructions[0]} (${step.durationMin} min)`;
            if (step.instructions.length > 1) {
              text += '\n' + step.instructions.slice(1).map(inst => `- ${inst}`).join('\n');
            }
          } else {
            text = `### ${i + 1}. Walk\nTo **${step.to.name}** (${step.durationMin} min)`;
          }
        } else if (step.type === 'ride') {
          text = `### ${i + 1}. Ride ${step.lineName}\n**${step.from.name}** to **${step.to.name}**\n(${step.durationMin} min, ${step.stations?.length ?? 0} stops)`;
        } else if (step.type === 'transfer') {
          text = `### ${i + 1}. Transfer\nAt **${step.from.name}** (${step.durationMin} min)`;
        }
        return text;
      }).join('\n\n') + 
      `\n\n---\n# 🚂 Safe Travels!`;

    try {
      const response = await fetch('http://localhost:2221/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: markdown })
      });
      if (response.ok) {
        alert('Sent to printer!');
      } else {
        const err = await response.json();
        alert('Print failed: ' + (err.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Could not connect to printer server. Make sure print_server.py is running.');
    }
  };

  return (
    <div className="directions-panel">
      <div className="directions-header">
        <h3>
          🚇 {route.totalMin} min total
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={handlePrint}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '6px',
              background: 'var(--ttc-red)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            🖨️ Print
          </button>
          <button 
            onClick={() => setShowText(true)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--text)'
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
