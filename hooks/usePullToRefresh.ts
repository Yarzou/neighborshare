'use client'

import { useRef, useState, useEffect, type RefObject } from 'react'

interface Options {
  /** Distance de tirage pour déclencher le refresh (px). Défaut : 72 */
  threshold?: number
  /** Distance maximale de tirage (px). Défaut : 100 */
  maxPull?: number
}

/**
 * Hook pull-to-refresh natif (touch events).
 * - Sans containerRef : écoute window (pages à scroll libre)
 * - Avec containerRef : écoute le div scrollable fourni
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  containerRef?: RefObject<HTMLElement | null>,
  { threshold = 72, maxPull = 100 }: Options = {},
) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const startYRef     = useRef<number | null>(null)
  const pullingRef    = useRef(false)
  const refreshingRef = useRef(false)
  const distanceRef   = useRef(0)
  const onRefreshRef  = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const getScrollTop = () =>
      containerRef?.current ? containerRef.current.scrollTop : window.scrollY

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || getScrollTop() > 0) return
      startYRef.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshingRef.current) return
      if (getScrollTop() > 0) { startYRef.current = null; return }

      const delta = e.touches[0].clientY - startYRef.current
      if (delta <= 0) {
        if (distanceRef.current > 0) { distanceRef.current = 0; setPullDistance(0) }
        return
      }

      pullingRef.current = true
      e.preventDefault()
      distanceRef.current = Math.min(delta * 0.5, maxPull)
      setPullDistance(distanceRef.current)
    }

    const onTouchEnd = async () => {
      if (!pullingRef.current || refreshingRef.current) {
        startYRef.current = null
        return
      }
      const d = distanceRef.current
      pullingRef.current = false
      startYRef.current = null

      if (d >= threshold) {
        refreshingRef.current = true
        setIsRefreshing(true)
        setPullDistance(threshold)
        try {
          await onRefreshRef.current()
        } finally {
          refreshingRef.current = false
          setIsRefreshing(false)
          distanceRef.current = 0
          setPullDistance(0)
        }
      } else {
        distanceRef.current = 0
        setPullDistance(0)
      }
    }

    const target: EventTarget = containerRef?.current ?? window
    target.addEventListener('touchstart', onTouchStart as EventListener, { passive: true })
    target.addEventListener('touchmove', onTouchMove as EventListener, { passive: false })
    target.addEventListener('touchend', onTouchEnd as EventListener, { passive: true })

    return () => {
      target.removeEventListener('touchstart', onTouchStart as EventListener)
      target.removeEventListener('touchmove', onTouchMove as EventListener)
      target.removeEventListener('touchend', onTouchEnd as EventListener)
    }
  }, [containerRef, threshold, maxPull])

  return { pullDistance, isRefreshing }
}
