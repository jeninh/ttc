import type { ReactNode } from 'react'
import { useBottomSheet, type SnapPoint } from '../hooks/useBottomSheet'
import { useEffect } from 'react'

interface Props {
  /** Snap points as fractions 0‒1 (0 = dismissed, 1 = full). Sorted ascending. */
  snaps?: SnapPoint[]
  /** Which snap to open at (index into snaps[]) */
  defaultSnap?: number
  /** Called when swiped to 0 */
  onDismiss?: () => void
  /** Render the content */
  children: ReactNode
  /** If true, show the dimmed backdrop */
  backdrop?: boolean
  /** Extra class on the sheet container */
  className?: string
  /** Whether the sheet is currently open (controls mount & re-open) */
  open?: boolean
}

export default function BottomSheet({
  snaps = [0, 0.4, 0.75, 0.95],
  defaultSnap = 1,
  onDismiss,
  children,
  backdrop = true,
  className = '',
  open = true,
}: Props) {
  const sheet = useBottomSheet({ snaps, defaultSnap, onDismiss })

  // When `open` changes from false→true, re-snap to default
  useEffect(() => {
    if (open) {
      sheet.snapTo(defaultSnap)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open && sheet.dismissed) return null

  return (
    <>
      {/* Backdrop */}
      {backdrop && snaps[sheet.snapIndex] > 0 && (
        <div
          className={`bs-backdrop ${sheet.snapIndex >= 2 ? 'bs-backdrop-visible' : ''}`}
          onClick={() => sheet.snapTo(0)}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheet.sheetRef}
        className={`bs-sheet ${className} ${sheet.dragging ? 'bs-dragging' : ''}`}
        style={sheet.style}
      >
        {/* Drag handle */}
        <div className="bs-handle" {...sheet.handleProps}>
          <div className="bs-handle-bar" />
        </div>

        {/* Content */}
        <div className="bs-content">{children}</div>
      </div>
    </>
  )
}
