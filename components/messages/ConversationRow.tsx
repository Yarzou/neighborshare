'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ConversationWithDetails, Profile } from '@/lib/types'

interface Props {
  conv: ConversationWithDetails
  userId: string
  onDelete: (id: string) => void
}

const SWIPE_THRESHOLD = 72 // px — largeur de la zone rouge

export function ConversationRow({ conv, userId, onDelete }: Props) {
  const router = useRouter()
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const didSwipe = useRef(false)

  const others = conv.participants
    .filter(p => p.user_id !== userId)
    .map(p => p.profiles as Profile | undefined)
    .filter(Boolean) as Profile[]
  const isGroup = others.length > 1
  const displayName =
    conv.name ||
    (isGroup
      ? others.map(p => p.full_name || p.username).join(', ')
      : others[0]?.full_name || others[0]?.username || 'Inconnu')
  const initials = isGroup ? '👥' : displayName[0]?.toUpperCase() || '?'
  const hasUnread = conv.unreadCount > 0

  // ── Touch handlers ─────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setSwiping(true)
    didSwipe.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    if (dx < 0) {
      didSwipe.current = true
      setSwipeX(Math.max(dx, -SWIPE_THRESHOLD - 16))
    }
  }

  const handleTouchEnd = () => {
    setSwiping(false)
    if (swipeX < -SWIPE_THRESHOLD * 0.6) {
      setSwipeX(-SWIPE_THRESHOLD)
    } else {
      setSwipeX(0)
    }
    touchStartX.current = null
  }

  const handleCardClick = () => {
    if (didSwipe.current) return
    router.push(`/messages/${conv.id}`)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSwipeX(0)
    onDelete(conv.id)
  }

  return (
    // Outer : overflow-hidden sert de masque pour la zone rouge (mobile)
    <div
      className="relative overflow-hidden rounded-2xl group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Zone rouge (derrière la carte, révélée par swipe) — mobile uniquement */}
      <div
        className="md:hidden absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 rounded-r-2xl"
        style={{ width: SWIPE_THRESHOLD }}
        onClick={handleDelete}
      >
        <Trash2 className="text-white" size={18} />
      </div>

      {/* Carte principale */}
      <div
        className={`relative bg-white rounded-2xl border p-4 flex items-center gap-3 w-full cursor-pointer hover:border-brand-300 transition-colors ${
          hasUnread ? 'border-brand-200 bg-brand-50/40' : 'border-gray-200'
        }`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease',
        }}
        onClick={handleCardClick}
      >
        {/* Avatar */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-lg ${
            isGroup ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'
          }`}
        >
          {isGroup ? <Users size={20} /> : initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm truncate ${
                hasUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'
              }`}
            >
              {displayName}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {conv.lastMessage
                ? formatDate(conv.lastMessage.created_at)
                : formatDate(conv.updated_at)}
            </span>
          </div>
          {conv.lastMessage && (
            <p
              className={`text-sm truncate mt-0.5 ${
                hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'
              }`}
            >
              {conv.lastMessage.sender_id === userId ? 'Vous : ' : ''}
              {conv.lastMessage.content}
            </p>
          )}
          {isGroup && (
            <p className="text-xs text-gray-400 mt-0.5">
              {others.length + 1} participants
            </p>
          )}
        </div>

        {hasUnread && (
          <div className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0" />
        )}

        {/* Bouton supprimer desktop — visible au hover uniquement */}
        <button
          onClick={handleDelete}
          aria-label="Supprimer la conversation"
          className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-red-100 text-red-400 hover:text-red-600 flex-shrink-0"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
