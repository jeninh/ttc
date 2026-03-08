import { useState } from 'react'
import type { Route } from '../services/routing'
import { getRelativeDirections } from '../services/relativeDirections'

interface Props {
  route: Route
  onClose: () => void
}

const LINE_COLORS: Record<string, string> = {
  '1': '#FFCC29',
  '2': '#00A859',
  '4': '#A900A9',
  '5': '#FF6E1E',
}

export default function RouteResult({ route, onClose }: Props) {
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [showRelative, setShowRelative] = useState(false)
  const [relativeText, setRelativeText] = useState<string | null>(null)
  const [relativeLoading, setRelativeLoading] = useState(false)
  const [relativeError, setRelativeError] = useState<string | null>(null)

  async function handleRelativeDirections() {
    if (relativeText) {
      setShowRelative(true)
      return
    }
    setRelativeLoading(true)
    setRelativeError(null)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
      const text = await getRelativeDirections(route, apiKey)
      setRelativeText(text)
      setShowRelative(true)
    } catch (err: any) {
      setRelativeError(err.message ?? 'Failed to generate directions')
    } finally {
      setRelativeLoading(false)
    }
  }

  const handlePrintRelative = async () => {
    if (!relativeText) return
    setPrintStatus('Sending to printer...');
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
      `\n\n---\n` +
      `## 📍 Relative Directions\n\n${relativeText}\n\n---\n` +
      `# 🚂 Safe Travels!`;

    try {
      const response = await fetch('http://localhost:2221/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: markdown })
      });
      if (response.ok) {
        setPrintStatus('✅ Printed successfully!');
        setTimeout(() => setPrintStatus(null), 5000);
      } else {
        const err = await response.json();
        setPrintStatus('❌ Print failed: ' + (err.error || 'Unknown error'));
        setTimeout(() => setPrintStatus(null), 5000);
      }
    } catch {
      setPrintStatus('❌ Could not connect to printer server.');
      setTimeout(() => setPrintStatus(null), 5000);
    }
  };

  const handlePrint = async () => {
    console.log("[DEBUG] handlePrint called with route:", route);
    setPrintStatus('Sending to printer...');
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
      `\n\n---\n` +
      (showRelative && relativeText
        ? `## 📍 Relative Directions\n\n${relativeText}\n\n---\n`
        : '') +
      `# 🚂 Safe Travels!`;

    console.log(`[DEBUG] Generated markdown payload (length: ${markdown.length}):`, markdown);
    try {
      console.log(`[DEBUG] Sending POST request to http://localhost:2221/print`);
      const response = await fetch('http://localhost:2221/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: markdown })
      });
      console.log(`[DEBUG] Print server response status: ${response.status}`);
      if (response.ok) {
        setPrintStatus('✅ Printed successfully!');
        setTimeout(() => setPrintStatus(null), 5000);
      } else {
        const err = await response.json();
        setPrintStatus('❌ Print failed: ' + (err.error || 'Unknown error'));
        setTimeout(() => setPrintStatus(null), 5000);
      }
    } catch (e) {
      console.error(`[DEBUG] Print fetch exception:`, e);
      setPrintStatus('❌ Could not connect to printer server.');
      setTimeout(() => setPrintStatus(null), 5000);
    }
  };

  return (
    <div className="route-result" role="region" aria-label="Route result">
      <div className="route-header">
        <div className="route-title">
          <span className="route-time-badge">🚇 {route.totalMin} min</span>
          <span className="route-summary">
            {route.fromStation.name} → {route.toStation.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="print-btn" 
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
              gap: '6px'
            }}
          >
             🖨️ Print
          </button>
          {printStatus && (
            <span style={{
              display: 'flex', 
              alignItems: 'center', 
              fontSize: '14px', 
              fontWeight: 'bold',
              color: printStatus.includes('❌') ? '#ff4444' : '#00C851'
            }}>
              {printStatus}
            </span>
          )}
          <button className="close-btn" onClick={onClose} aria-label="Close route">✕</button>
        </div>
      </div>

      <div className="route-steps">
        {route.steps.map((step, i) => (
          <div key={i} className={`route-step step-${step.type}`}>
            <div className="step-connector">
              <div className="step-dot" style={step.type === 'ride' ? { background: LINE_COLORS[step.line ?? ''] ?? '#888' } : undefined} />
              {i < route.steps.length - 1 && <div className="step-line" />}
            </div>
            <div className="step-body">
              {step.type === 'walk' && (
                <div className="step-walk">
                  <span className="step-emoji">🚶</span>
                  <div className="step-text">
                    {step.instructions && step.instructions.length > 0 ? (
                      <>
                        <strong>{step.instructions[0]}</strong>
                        {step.instructions.length > 1 && (
                          <ul className="walk-sub">
                            {step.instructions.slice(1).map((inst, idx) => (
                              <li key={idx}>{inst}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <strong>Walk to {step.to.name}</strong>
                    )}
                    <span className="step-dur">{step.durationMin} min</span>
                  </div>
                </div>
              )}
              {step.type === 'ride' && (
                <div className="step-ride">
                  <span className="step-emoji">🚇</span>
                  <div className="step-text">
                    <span className="line-chip" style={{ background: LINE_COLORS[step.line ?? ''] ?? '#888' }}>
                      {step.lineName}
                    </span>
                    <strong>{step.from.name} → {step.to.name}</strong>
                    <span className="step-dur">{step.durationMin} min · {step.stations?.length ?? 0} stops</span>
                    {step.stations && step.stations.length > 2 && (
                      <details className="stops-detail">
                        <summary>View all stops</summary>
                        <ol>
                          {step.stations.map((s) => <li key={s.id}>{s.name}</li>)}
                        </ol>
                      </details>
                    )}
                  </div>
                </div>
              )}
              {step.type === 'transfer' && (
                <div className="step-transfer">
                  <span className="step-emoji">🔄</span>
                  <div className="step-text">
                    <strong>Transfer at {step.from.name}</strong>
                    <span className="step-dur">{step.durationMin} min</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className={`relative-directions-btn ${showRelative ? 'active' : ''}`}
        onClick={handleRelativeDirections}
        disabled={relativeLoading}
        style={{
          width: '100%',
          padding: '12px',
          border: 'none',
          borderRadius: '8px',
          background: showRelative ? 'rgba(218, 55, 50, 0.2)' : 'rgba(255, 255, 255, 0.08)',
          color: 'white',
          cursor: relativeLoading ? 'wait' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          marginTop: '12px',
          transition: 'all 0.2s',
        }}
      >
        {relativeLoading ? '⏳ Generating landmark directions…' : '📍 Relative Directions'}
      </button>

      {relativeError && (
        <p style={{ color: '#ff4444', fontSize: '13px', marginTop: '8px' }}>⚠️ {relativeError}</p>
      )}

      {showRelative && relativeText && (
        <div className="relative-popup-overlay" onClick={() => setShowRelative(false)}>
          <div className="relative-popup" onClick={(e) => e.stopPropagation()}>
            <div className="relative-popup-header">
              <h3>📍 Relative Directions</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="print-btn"
                  onClick={handlePrintRelative}
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
                    gap: '6px',
                  }}
                >
                  🖨️ Print
                </button>
                <button
                  className="close-btn"
                  onClick={() => setShowRelative(false)}
                  aria-label="Close relative directions"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="relative-popup-body">
              {relativeText.split('\n').map((line, i) => (
                <p key={i} style={{ margin: '4px 0' }}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
