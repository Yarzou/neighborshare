'use client'

import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { formatDateTime, getAvatarStyle } from '@/lib/utils'
import type { DirectMessage, MessageEmoji } from '@/lib/types'
import { MESSAGE_EMOJIS } from '@/lib/types'

interface Props {
  msg: DirectMessage
  isMe: boolean
  isGroup: boolean
  isSameAuthor: boolean
  showSender: boolean
  senderName: string
  senderInitial: string
  senderAvatarColor?: string | null
  currentUserId: string | null
  onDelete: (id: string) => void
  onReact: (messageId: string, emoji: MessageEmoji) => void
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
  senderAvatarColor,
  currentUserId,
  onDelete,
  onReact,
}: Props) {
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const isTemp = msg.id.startsWith('temp-')
  const canDelete = isMe && !isTemp

  // ── Groupement des réactions ────────────────────────────────────────────────
  const reactionGroups = MESSAGE_EMOJIS.reduce<Record<string, { count: number; mine: boolean }>>(
    (acc, emoji) => {
      const group = msg.reactions?.filter(r => r.emoji === emoji) ?? []
      if (group.length > 0) {
        acc[emoji] = {
          count: group.length,
          mine: group.some(r => r.user_id === currentUserId),
        }
      }
      return acc
    },
    {}
  )
  const hasReactions = Object.keys(reactionGroups).length > 0

  // ── Système ────────────────────────────────────────────────────────────────
  if (msg.is_system) {
    return (
      <div className="flex justify-center py-2 px-4">
        <div className="flex flex-col items-center gap-1 max-w-xs text-center">
          <span className="text-xs text-gray-500 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200 font-medium">
            {msg.content}
          </span>
          <span className="text-[10px] text-gray-400">{formatDateTime(msg.created_at)}</span>
        </div>
      </div>
    )
  }

  // ── Touch handlers (mobile swipe to delete + long press to react) ──────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setSwiping(true)

    if (!isTemp) {
      longPressTimer.current = setTimeout(() => {
        setShowPicker(true)
        setSwiping(false)
        setSwipeX(0)
      }, 500)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return

    const dx = e.touches[0].clientX - touchStartX.current
    // Si l'utilisateur glisse, annule le long press
    if (Math.abs(dx) > 10 && longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    // Seulement glisser vers la gauche pour mes messages (suppression)
    if (canDelete && dx < 0) setSwipeX(Math.max(dx, -SWIPE_THRESHOLD - 20))
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setSwiping(false)
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

  const handleEmojiClick = (emoji: MessageEmoji) => {
    setShowPicker(false)
    onReact(msg.id, emoji)
  }

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar autres participants */}
      {!isMe && (
        <div
          className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${isSameAuthor ? 'opacity-0' : ''}`}
          style={isSameAuthor ? undefined : getAvatarStyle(senderAvatarColor)}
        >
          {senderInitial}
        </div>
      )}

      <div
        className={`flex flex-col gap-0.5 max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}
      >
        <span className="text-[11px] text-gray-400 px-1">{formatDateTime(msg.created_at)}</span>
        {showSender && (
          <span className="text-xs text-gray-400 px-1">{senderName}</span>
        )}

        {/* Wrapper relatif pour le bouton supprimer (mobile swipe) */}
        <div className="relative">
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

          {/* Bulle */}
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

            {/* Bouton réaction desktop (hover) */}
            {!isTemp && (
              <div className={`relative hidden md:flex flex-shrink-0 ${isMe ? 'order-last ml-1' : 'order-first mr-1'}`}>
                <button
                  onClick={() => setShowPicker(v => !v)}
                  aria-label="Ajouter une réaction"
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-sm leading-none"
                >
                  😊
                </button>
                {/* Palette desktop */}
                {showPicker && (
                  <div
                    ref={pickerRef}
                    className={`absolute bottom-full mb-1 z-20 bg-white border border-gray-200 rounded-2xl shadow-lg px-2 py-1.5 flex gap-1 ${
                      isMe ? 'right-0' : 'left-0'
                    }`}
                  >
                    {MESSAGE_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiClick(emoji as MessageEmoji)}
                        className="text-lg hover:scale-125 transition-transform leading-none p-0.5"
                        aria-label={`Réagir avec ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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

        {/* Réactions affichées sous la bulle */}
        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-0.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {(Object.entries(reactionGroups) as [string, { count: number; mine: boolean }][]).map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                onClick={() => !isTemp && onReact(msg.id, emoji as MessageEmoji)}
                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  mine
                    ? 'bg-brand-100 border-brand-300 text-brand-700 dark:bg-brand-900 dark:border-brand-600 dark:text-brand-300'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                }`}
                aria-label={`${emoji} ${count}`}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="font-medium">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Palette mobile (long press) — overlay centré */}
      {showPicker && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-2xl shadow-xl px-3 py-2 flex gap-2"
            onClick={e => e.stopPropagation()}
          >
            {MESSAGE_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji as MessageEmoji)}
                className="text-2xl hover:scale-125 active:scale-110 transition-transform leading-none p-1"
                aria-label={`Réagir avec ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
