'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, CalendarDays, MessageCircle, ClipboardList, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Props {
  firstName: string | null
  avatarUrl: string | null
  avatarColor: string | null
}

interface Tile {
  label: string
  description: string
  icon: React.ReactNode
  href: string
  badge?: number
}

export default function DashboardClient({ firstName, avatarUrl, avatarColor }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return
      setUserId(data.user.id)
      await Promise.all([fetchUnread(data.user.id), fetchPendingRequests(data.user.id)])
    }
    void init()
  }, [])

  const fetchUnread = async (uid: string) => {
    const { data: parts } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', uid)

    if (!parts || parts.length === 0) { setUnreadCount(0); return }

    let total = 0
    await Promise.all(parts.map(async (p) => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', p.conversation_id)
        .neq('sender_id', uid)
        .gt('created_at', p.last_read_at)
      total += count ?? 0
    }))
    setUnreadCount(total)
  }

  const fetchPendingRequests = async (uid: string) => {
    const [{ count: asOwner }, { count: asResponder }] = await Promise.all([
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .in('status', ['en_cours', 'validee']),
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('responder_id', uid)
        .in('status', ['en_cours', 'validee']),
    ])
    setPendingRequestsCount((asOwner ?? 0) + (asResponder ?? 0))
  }

  const tiles: Tile[] = [
    {
      label: 'Annonces',
      description: 'Parcourir les offres du quartier',
      icon: <MapPin size={32} />,
      href: '/map',
    },
    {
      label: 'Événements',
      description: 'Voir les événements à venir',
      icon: <CalendarDays size={32} />,
      href: '/evenements',
    },
    {
      label: 'Messages',
      description: 'Vos conversations en cours',
      icon: <MessageCircle size={32} />,
      href: '/messages',
      badge: unreadCount,
    },
    {
      label: 'Demandes',
      description: 'Suivre vos échanges actifs',
      icon: <ClipboardList size={32} />,
      href: '/demandes',
      badge: pendingRequestsCount,
    },
    {
      label: 'Mon profil',
      description: 'Gérer votre compte',
      icon: <User size={32} />,
      href: '/profile',
    },
  ]

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Bonjour{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-gray-500 text-base">Que souhaitez-vous faire aujourd'hui ?</p>
        </div>

        {/* Tiles grid: 2 cols, last tile centered */}
        <div className="grid grid-cols-2 gap-4">
          {tiles.map((tile, i) => {
            const isLast = i === tiles.length - 1

            const tileButton = (
              <button
                key={tile.href}
                onClick={() => router.push(tile.href)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl',
                  'bg-white border border-gray-200 shadow-sm',
                  'hover:border-brand-400 hover:bg-brand-50 transition-all duration-150',
                  'cursor-pointer text-center group w-full'
                )}
              >
                {/* Badge */}
                {(tile.badge ?? 0) > 0 && (
                  <span className="absolute top-3 right-3 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
                    {(tile.badge ?? 0) > 9 ? '9+' : tile.badge}
                  </span>
                )}
                <span className="text-brand-600 group-hover:text-brand-700 transition-colors">
                  {tile.icon}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 text-base">{tile.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{tile.description}</p>
                </div>
              </button>
            )

            if (isLast) {
              return (
                <div key={tile.href} className="col-span-2 flex justify-center">
                  <div className="w-1/2">{tileButton}</div>
                </div>
              )
            }

            return <div key={tile.href}>{tileButton}</div>
          })}
        </div>
      </div>
    </div>
  )
}
