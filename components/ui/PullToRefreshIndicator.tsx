import { Loader2, RefreshCw } from 'lucide-react'

interface Props {
  pullDistance: number
  isRefreshing: boolean
  threshold?: number
}

/**
 * Indicateur visuel du pull-to-refresh.
 * S'insère en haut d'un conteneur scrollable :
 *   son height suit pullDistance et révèle l'icône.
 */
export function PullToRefreshIndicator({ pullDistance, isRefreshing, threshold = 72 }: Props) {
  const height = isRefreshing ? threshold : pullDistance
  if (height === 0) return null

  const progress = Math.min(pullDistance / threshold, 1)

  return (
    <div
      className="flex items-center justify-center text-brand-500 flex-shrink-0"
      style={{
        height,
        overflow: 'hidden',
        transition: isRefreshing ? 'height 0.15s ease' : 'none',
      }}
    >
      {isRefreshing ? (
        <Loader2 size={22} className="animate-spin" />
      ) : (
        <RefreshCw
          size={22}
          style={{
            transform: `rotate(${progress * 270}deg)`,
            opacity: 0.3 + progress * 0.7,
            transition: 'none',
          }}
        />
      )}
    </div>
  )
}
