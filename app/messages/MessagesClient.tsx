'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Plus, Loader2 } from 'lucide-react'
import type { ConversationWithDetails, ConversationParticipant, DirectMessage } from '@/lib/types'
import { ConversationRow } from '@/components/messages/ConversationRow'

export default function MessagesClient() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])

  const buildConversations = useCallback(async (uid: string) => {
    // 1. Participations de l'utilisateur courant (exclut les conversations supprimées)
    const { data: myParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, visible_from')
      .eq('user_id', uid)
      .is('deleted_at', null)

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
      .select('conversation_id, user_id, last_read_at, joined_at, profiles(id, username, full_name, avatar_url, avatar_color)')
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

    // Indexer le dernier message visible par conversation (respecte visible_from)
    const visibleFromMap: Record<string, string | null> = {}
    for (const p of myParts ?? []) visibleFromMap[p.conversation_id] = p.visible_from ?? null

    const lastMsgMap: Record<string, DirectMessage> = {}
    for (const m of allMsgs ?? []) {
      if (lastMsgMap[m.conversation_id]) continue
      const visibleFrom = visibleFromMap[m.conversation_id]
      if (visibleFrom && new Date(m.created_at) < new Date(visibleFrom)) continue
      lastMsgMap[m.conversation_id] = m as DirectMessage
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

  const handleDeleteConversation = async (convId: string) => {
    // Soft delete : masque la conversation + mémorise la coupure d'historique
    const now = new Date().toISOString()
    setConversations(prev => prev.filter(c => c.id !== convId))
    const { error } = await supabase
      .from('conversation_participants')
      .update({ deleted_at: now, visible_from: now })
      .eq('conversation_id', convId)
      .eq('user_id', userId!)
    if (error) {
      await buildConversations(userId!)
    }
  }

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
          className="flex items-center justify-center gap-1.5
                     w-10 h-10 rounded-full
                     sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:rounded-xl
                     bg-brand-600 text-white hover:bg-brand-700 transition-colors
                     text-sm font-medium flex-shrink-0"
          aria-label="Nouvelle conversation"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Nouvelle conversation</span>
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Aucune conversation pour l&apos;instant</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map(conv => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              userId={userId!}
              onDelete={handleDeleteConversation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
