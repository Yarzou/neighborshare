'use client'

import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { DirectMessage } from '@/lib/types'

interface Props {
  msg: DirectMessage
  isMe: boolean
  isGroup: boolean
  isSameAuthor: boolean
  showSender: boolean
  senderName: string
  senderInitial: string
  onDelete: (id: string) => void
}

const SWIPE_THRESHOLD = 60 // px

export function MessageBubble({
  msg,
  isMe,
  isGroup,
  isSameAuthor,
  showSender,
  senderName,
  senderInitial,
  onDelete,
}: Props) {
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const isTemp = msg.id.startsWith('temp-')
  const canDelete = isMe && !isTemp

  // ── Touch handlers (mobile swipe) ──────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canDelete) return
    touchStartX.current = e.touches[0].clientX
    setSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canDelete || touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    // Seulement glisser vers la gauche (dx négatif)
    if (dx < 0) setSwipeX(Math.max(dx, -SWIPE_THRESHOLD - 20))
  }

  const handleTouchEnd = () => {
    if (!canDelete) return
    setSwiping(false)
    // Si on a dépassé le seuil, on garde le bouton visible; sinon snap-back
    if (swipeX < -SWIPE_THRESHOLD) {
      setSwipeX(-SWIPE_THRESHOLD)
    } else {
      setSwipeX(0)
    }
    touchStartX.current = null
  }

  const handleDeleteClick = () => {
    setSwipeX(0)
    onDelete(msg.id)
  }

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar autres participants */}
      {!isMe && (
        <div
          className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
            isSameAuthor ? 'opacity-0' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {senderInitial}
        </div>
      )}

      {/* Zone swipeable (mobile) + hover (desktop) */}
      <div
        className={`flex flex-col gap-0.5 max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}
      >
        <span className="text-[11px] text-gray-400 px-1">{formatDateTime(msg.created_at)}</span>
        {showSender && (
          <span className="text-xs text-gray-400 px-1">{senderName}</span>
        )}

        {/* Wrapper relatif pour superposer le bouton supprimer (mobile) */}
        <div className="relative">
          {/* Bouton supprimer mobile : invisible jusqu'au swipe, révélé progressivement */}
          {canDelete && (
            <button
              onClick={handleDeleteClick}
              aria-label="Supprimer"
              className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pr-1 h-full flex items-center"
              style={{
                opacity: Math.min(1, Math.max(0, (-swipeX - 20) / 40)),
                pointerEvents: swipeX < -SWIPE_THRESHOLD * 0.7 ? 'auto' : 'none',
              }}
            >
              <span className="flex items-center justify-center w-10 h-8 rounded-xl bg-red-500 text-white">
                <Trash2 size={15} />
              </span>
            </button>
          )}

          {/* Bulle — groupe hover desktop */}
          <div
            className={`group relative flex items-center gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
            style={{
              transform: `translateX(${swipeX}px)`,
              transition: swiping ? 'none' : 'transform 0.2s ease',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Bouton supprimer desktop (hover) */}
            {canDelete && (
              <button
                onClick={handleDeleteClick}
                aria-label="Supprimer ce message"
                className={`hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-red-100 text-red-400 hover:text-red-600 flex-shrink-0 ${
                  isMe ? 'order-first mr-1' : 'order-last ml-1'
                }`}
              >
                <Trash2 size={13} />
              </button>
            )}

            <div
              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed select-none ${
                isMe
                  ? 'bg-green-500 text-white rounded-br-sm'
                  : 'bg-blue-500 text-white rounded-bl-sm'
              } ${isTemp ? 'opacity-60' : ''}`}
            >
              {msg.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
