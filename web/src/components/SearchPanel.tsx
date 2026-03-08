import { useState, useRef, useEffect, useCallback } from 'react'
import { geocode, type GeoResult } from '../services/geocoding'
import { stations } from '../data/stations'

interface SearchResult {
  geo: GeoResult
  label: string
  isStation: boolean
}

interface Props {
  label: string
  placeholder: string
  onSelect: (result: GeoResult) => void
  value: string
  onChange: (val: string) => void
}

function matchStations(query: string): SearchResult[] {
  const q = query.toLowerCase().trim()
  if (q.length < 1) return []
  const seen = new Set<string>()
  return stations
    .filter((s) => {
      if (seen.has(s.name)) return false
      seen.add(s.name)
      return s.name.toLowerCase().includes(q)
    })
    .slice(0, 5)
    .map((s) => ({
      geo: { lat: s.lat, lng: s.lng, displayName: `${s.name} Station` },
      label: `${s.name} Station`,
      isStation: true,
    }))
}

export default function SearchPanel({ label, placeholder, onSelect, value, onChange }: Props) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<number>(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectResult = useCallback(
    (r: SearchResult) => {
      onSelect(r.geo)
      onChange(r.label)
      setShowDropdown(false)
      setActiveIdx(-1)
    },
    [onSelect, onChange],
  )

  const handleInput = (text: string) => {
    onChange(text)
    setActiveIdx(-1)
    clearTimeout(debounceRef.current)

    // Instant local station matches
    const stationResults = matchStations(text)

    // Show stations immediately
    setResults(stationResults)
    setShowDropdown(stationResults.length > 0)

    if (text.length < 2) {
      return
    }

    debounceRef.current = window.setTimeout(async () => {
      setLoading(true)
      try {
        const geoResults = await geocode(text)
        const addressResults: SearchResult[] = geoResults.map((r) => ({
          geo: r,
          label: r.displayName.split(',').slice(0, 3).join(',').trim(),
          isStation: false,
        }))
        // Stations first, then addresses (deduplicated)
        const stationLabels = new Set(stationResults.map((s) => s.label.toLowerCase()))
        const filtered = addressResults.filter(
          (a) => !stationLabels.has(a.label.toLowerCase()),
        )
        const combined = [...stationResults, ...filtered]
        setResults(combined)
        setShowDropdown(combined.length > 0)
      } finally {
        setLoading(false)
      }
    }, 750)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = activeIdx < results.length - 1 ? activeIdx + 1 : 0
      setActiveIdx(next)
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = activeIdx > 0 ? activeIdx - 1 : results.length - 1
      setActiveIdx(next)
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && activeIdx < results.length) {
        selectResult(results[activeIdx])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIdx(-1)
    }
  }

  return (
    <div ref={wrapperRef} className="search-field">
      <label>{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
      />
      {loading && <span className="search-spinner" />}
      {showDropdown && (
        <ul ref={listRef} className="search-dropdown">
          {results.map((r, i) => (
            <li
              key={i}
              className={`search-result${r.isStation ? ' search-result-station' : ''}${i === activeIdx ? ' search-result-active' : ''}`}
              onClick={() => selectResult(r)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {r.isStation && <span className="station-badge">🚇</span>}
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
