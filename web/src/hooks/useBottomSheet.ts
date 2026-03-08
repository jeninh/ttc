import { useRef, useCallback, useState, useEffect } from 'react'

export type SnapPoint = number // 0..1 fraction of available height

interface Options {
  snaps: SnapPoint[]
  defaultSnap?: number
  onDismiss?: () => void
  flingThreshold?: number
}

export interface BottomSheetHandle {
  snapIndex: number
  snapTo: (index: number) => void
  sheetRef: React.RefObject<HTMLDivElement | null>
  handleProps: {
    onTouchStart: (e: React.TouchEvent) => void
    onMouseDown: (e: React.MouseEvent) => void
  }
  style: React.CSSProperties
  dragging: boolean
  dismissed: boolean
}

export function useBottomSheet(opts: Options): BottomSheetHandle {
  const {
    snaps,
    defaultSnap = snaps.length - 1,
    onDismiss,
    flingThreshold = 0.4,
  } = opts

  const [snapIndex, setSnapIndex] = useState(defaultSnap)
  const [dragging, setDragging] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const sheetRef = useRef<HTMLDivElement | null>(null)

  // All mutable drag state in a single ref to avoid stale closures
  const dragState = useRef({
    startY: 0,
    startTranslate: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
    translateY: 0,
  })

  // Use a ref-backed translateY to avoid re-render on every pixel of drag
  const [, forceRender] = useState(0)
  const translateYRef = useRef(0)
  const setTranslateY = useCallback((v: number) => {
    translateYRef.current = v
    dragState.current.translateY = v
    forceRender((n) => n + 1)
  }, [])

  // Keep callbacks in refs so global handlers never go stale
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  const snapsRef = useRef(snaps)
  snapsRef.current = snaps

  const getAvailableHeight = useCallback(() => {
    if (typeof window === 'undefined') return 600
    const tabBar = document.querySelector('.mobile-tab-bar') as HTMLElement | null
    const tabBarH = tabBar ? tabBar.offsetHeight : 56
    const vh = window.visualViewport?.height ?? window.innerHeight
    return vh - tabBarH
  }, [])

  const snapToTranslateY = useCallback(
    (snapFrac: number) => {
      const avail = getAvailableHeight()
      return avail * (1 - snapFrac)
    },
    [getAvailableHeight],
  )

  // Set initial position
  useEffect(() => {
    setTranslateY(snapToTranslateY(snaps[defaultSnap]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const snapTo = useCallback(
    (index: number) => {
      const s = snapsRef.current
      if (index < 0 || index >= s.length) return
      const target = snapToTranslateY(s[index])
      setSnapIndex(index)
      setTransitioning(true)
      setTranslateY(target)
      if (s[index] === 0) {
        setDismissed(true)
        onDismissRef.current?.()
      }
      setTimeout(() => setTransitioning(false), 320)
    },
    [snapToTranslateY, setTranslateY],
  )

  const snapToRef = useRef(snapTo)
  snapToRef.current = snapTo

  const findNearestSnap = useCallback(
    (ty: number, vel: number): number => {
      const s = snapsRef.current
      const avail = getAvailableHeight()
      const currentFrac = 1 - ty / avail

      if (Math.abs(vel) > flingThreshold) {
        if (vel > 0) {
          for (let i = s.length - 1; i >= 0; i--) {
            if (s[i] < currentFrac - 0.02) return i
          }
          return 0
        } else {
          for (let i = 0; i < s.length; i++) {
            if (s[i] > currentFrac + 0.02) return i
          }
          return s.length - 1
        }
      }

      let bestIdx = 0
      let bestDist = Infinity
      for (let i = 0; i < s.length; i++) {
        const dist = Math.abs(s[i] - currentFrac)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      }
      return bestIdx
    },
    [getAvailableHeight, flingThreshold],
  )

  // Stable global handlers using refs — no stale closures
  const handlersRef = useRef<{
    onTouchMove: (e: TouchEvent) => void
    onTouchEnd: () => void
    onMouseMove: (e: MouseEvent) => void
    onMouseUp: () => void
  } | null>(null)

  if (!handlersRef.current) {
    const moveWith = (clientY: number) => {
      const ds = dragState.current
      const dy = clientY - ds.startY
      const now = performance.now()
      const dt = now - ds.lastTime
      if (dt > 0) {
        ds.velocity = (clientY - ds.lastY) / dt
      }
      ds.lastY = clientY
      ds.lastTime = now

      let newTY = ds.startTranslate + dy
      const avail = getAvailableHeight()
      if (newTY < 0) newTY = newTY * 0.2 // rubber band
      if (newTY > avail) newTY = avail
      translateYRef.current = newTY
      ds.translateY = newTY
      forceRender((n) => n + 1)
    }

    const endDrag = () => {
      const ds = dragState.current
      setDragging(false)
      const best = findNearestSnap(ds.translateY, ds.velocity)
      snapToRef.current(best)
      window.removeEventListener('touchmove', handlersRef.current!.onTouchMove)
      window.removeEventListener('touchend', handlersRef.current!.onTouchEnd)
      window.removeEventListener('mousemove', handlersRef.current!.onMouseMove)
      window.removeEventListener('mouseup', handlersRef.current!.onMouseUp)
    }

    handlersRef.current = {
      onTouchMove: (e: TouchEvent) => {
        e.preventDefault()
        moveWith(e.touches[0].clientY)
      },
      onTouchEnd: endDrag,
      onMouseMove: (e: MouseEvent) => {
        e.preventDefault()
        moveWith(e.clientY)
      },
      onMouseUp: endDrag,
    }
  }

  const beginDrag = useCallback(
    (clientY: number) => {
      const ds = dragState.current
      setDragging(true)
      setDismissed(false)
      ds.startY = clientY
      ds.startTranslate = translateYRef.current
      ds.lastY = clientY
      ds.lastTime = performance.now()
      ds.velocity = 0
    },
    [],
  )

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      beginDrag(e.touches[0].clientY)
      window.addEventListener('touchmove', handlersRef.current!.onTouchMove, { passive: false })
      window.addEventListener('touchend', handlersRef.current!.onTouchEnd)
    },
    [beginDrag],
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      beginDrag(e.clientY)
      window.addEventListener('mousemove', handlersRef.current!.onMouseMove)
      window.addEventListener('mouseup', handlersRef.current!.onMouseUp)
    },
    [beginDrag],
  )

  // Re-snap on any viewport change (resize, orientation, virtual keyboard)
  useEffect(() => {
    const onResize = () => {
      setTranslateY(snapToTranslateY(snapsRef.current[snapIndex]))
    }
    window.addEventListener('resize', onResize)

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', onResize)
    }

    return () => {
      window.removeEventListener('resize', onResize)
      if (vv) {
        vv.removeEventListener('resize', onResize)
      }
    }
  }, [snapIndex, snapToTranslateY, setTranslateY])

  const style: React.CSSProperties = {
    transform: `translateY(${translateYRef.current}px)`,
    transition: transitioning && !dragging ? 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
    willChange: dragging ? 'transform' : 'auto',
  }

  return {
    snapIndex,
    snapTo,
    sheetRef,
    handleProps: {
      onTouchStart,
      onMouseDown,
    },
    style,
    dragging,
    dismissed,
  }
}
