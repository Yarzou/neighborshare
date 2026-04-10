'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Plus, Loader2, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ConversationWithDetails, ConversationParticipant, DirectMessage, Profile } from '@/lib/types'

export default function MessagesClient() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])

  const buildConversations = useCallback(async (uid: string) => {
    // 1. Participations de l'utilisateur courant
    const { data: myParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', uid)

    const convIds = (myParts ?? []).map(p => p.conversation_id)
    if (convIds.length === 0) { setConversations([]); return }

    // 2. Conversations triées par updated_at
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, name, created_at, updated_at')
      .in('id', convIds)
      .order('updated_at', { ascending: false })

    // 3. Tous les participants avec leur profil
    const { data: allParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, last_read_at, joined_at, profiles(id, username, full_name, avatar_url)')
      .in('conversation_id', convIds)

    // 4. Dernier message par conversation
    const { data: allMsgs } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })

    // Grouper les participants et messages par conversation
    const partsMap: Record<string, ConversationParticipant[]> = {}
    for (const p of allParts ?? []) {
      if (!partsMap[p.conversation_id]) partsMap[p.conversation_id] = []
      partsMap[p.conversation_id].push(p as unknown as ConversationParticipant)
    }

    const lastMsgMap: Record<string, DirectMessage> = {}
    for (const m of allMsgs ?? []) {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m as DirectMessage
    }

    // Unread: messages après last_read_at du current user
    const lastReadMap: Record<string, string> = {}
    for (const p of myParts ?? []) lastReadMap[p.conversation_id] = p.last_read_at

    const result: ConversationWithDetails[] = (convs ?? []).map(conv => {
      const parts = partsMap[conv.id] ?? []
      const lastMsg = lastMsgMap[conv.id] ?? null
      const lastRead = lastReadMap[conv.id]
      const unread = lastMsg && lastMsg.sender_id !== uid && lastRead
        ? new Date(lastMsg.created_at) > new Date(lastRead) ? 1 : 0
        : 0
      return { ...conv, participants: parts, lastMessage: lastMsg, unreadCount: unread }
    })

    setConversations(result)
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login?redirect=%2Fmessages')
        return
      }
      setUserId(user.id)
      await buildConversations(user.id)
      setLoading(false)
    }
    init()
  }, [])

  // Realtime: met à jour la liste à chaque nouveau message
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('messages_list_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        buildConversations(userId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, buildConversations])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="text-brand-600" size={26} />
          Messages
        </h1>
        <Link
          href="/messages/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          <Plus size={15} /> Nouvelle conversation
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Aucune conversation pour l&apos;instant</p>
          <p className="text-sm mt-1">Démarrez une discussion avec vos voisins !</p>
          <Link href="/messages/new"
            className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors">
            <Plus size={14} /> Nouvelle conversation
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map(conv => {
            const others = conv.participants
              .filter(p => p.user_id !== userId)
              .map(p => p.profiles as Profile | undefined)
              .filter(Boolean) as Profile[]
            const isGroup = others.length > 1
            const displayName = conv.name
              || (isGroup
                ? others.map(p => p.full_name || p.username).join(', ')
                : (others[0]?.full_name || others[0]?.username || 'Inconnu'))
            const initials = isGroup ? '👥' : (displayName[0]?.toUpperCase() || '?')
            const hasUnread = conv.unreadCount > 0

            return (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className={`bg-white rounded-2xl border p-4 flex items-center gap-3 hover:border-brand-300 transition-colors ${hasUnread ? 'border-brand-200 bg-brand-50/40' : 'border-gray-200'}`}
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-lg ${isGroup ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'}`}>
                  {isGroup ? <Users size={20} /> : initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${hasUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                      {displayName}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {conv.lastMessage ? formatDate(conv.lastMessage.created_at) : formatDate(conv.updated_at)}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <p className={`text-sm truncate mt-0.5 ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {conv.lastMessage.sender_id === userId ? 'Vous : ' : ''}
                      {conv.lastMessage.content}
                    </p>
                  )}
                  {isGroup && (
                    <p className="text-xs text-gray-400 mt-0.5">{others.length + 1} participants</p>
                  )}
                </div>

                {hasUnread && (
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
