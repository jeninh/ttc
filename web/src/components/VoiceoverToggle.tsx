import { useState, useEffect, useCallback, useRef } from 'react'
import { useAudio } from '../contexts/AudioContext'

export default function VoiceoverToggle({ shiftRight }: { shiftRight?: boolean }) {
  const [enabled, setEnabled] = useState(false)
  const { playText, stopAudio } = useAudio()
  const timeoutRef = useRef<number>(0)
  const lastTextRef = useRef<string>('')

  const handleMouseOver = useCallback((e: MouseEvent) => {
    if (!enabled) return

    // Find closest element with text
    let target = e.target as HTMLElement
    while (target && target !== document.body) {
      if (
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.tagName === 'LABEL' ||
        target.tagName === 'P' ||
        target.tagName === 'H1' ||
        target.tagName === 'H2' ||
        target.tagName === 'H3' ||
        target.tagName === 'LI' ||
        target.tagName === 'SPAN' ||
        target.classList.contains('station-badge') ||
        target.classList.contains('leaflet-tooltip') ||
        target.classList.contains('leaflet-popup-content') ||
        target.classList.contains('location-name') ||
        target.closest('.leaflet-marker-icon') ||
        target.tagName.toLowerCase() === 'svg' ||
        target.tagName.toLowerCase() === 'path'
      ) {
        let textToRead = target.innerText || target.textContent
        if (target.tagName === 'INPUT') {
            textToRead = (target as HTMLInputElement).value || (target as HTMLInputElement).placeholder
        }
        
        // Try getting SVG aria-labels or Leaflet marker titles/alt attributes if textContent is empty
        if (!textToRead || !textToRead.trim()) {
            textToRead = target.getAttribute('aria-label') || target.getAttribute('title') || target.getAttribute('alt') || ''
        }
        
        if (textToRead) {
            textToRead = textToRead.trim()
            if (textToRead && textToRead !== lastTextRef.current) {
                lastTextRef.current = textToRead
                clearTimeout(timeoutRef.current)
                timeoutRef.current = window.setTimeout(() => {
                    playText(textToRead as string)
                }, 500) // 500ms hover clear threshold before reading
            }
            break
        }
      }
      target = target.parentElement as HTMLElement
    }
  }, [enabled, playText])

  const handleMouseOut = useCallback(() => {
    if (!enabled) return
    clearTimeout(timeoutRef.current)
  }, [enabled])

  useEffect(() => {
    if (enabled) {
      document.addEventListener('mouseover', handleMouseOver)
      document.addEventListener('mouseout', handleMouseOut)
    } else {
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      stopAudio()
      lastTextRef.current = ''
    }

    return () => {
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      clearTimeout(timeoutRef.current)
    }
  }, [enabled, handleMouseOver, handleMouseOut, stopAudio])

  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className={`voiceover-toggle ${enabled ? 'active' : ''}`}
      title={enabled ? "Disable Voiceover" : "Enable Voiceover"}
      style={{
        position: 'fixed',
        top: '20px',
        left: shiftRight ? '340px' : '20px',
        zIndex: 9999,
        padding: '10px 15px',
        borderRadius: '30px',
        border: 'none',
        backgroundColor: enabled ? '#4CAF50' : '#333',
        color: 'white',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: 'bold',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>{enabled ? '🔊' : '🔇'}</span>
      {enabled ? 'Voiceover On' : 'Voiceover Off'}
    </button>
  )
}
