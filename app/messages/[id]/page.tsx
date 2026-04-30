'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Loader2, Users, UserCircle2, Package } from 'lucide-react'
import type { DirectMessage, ConversationParticipant, Profile } from '@/lib/types'
import { formatDateTime, getAvatarStyle } from '@/lib/utils'
import { MessageBubble } from '@/components/messages/MessageBubble'

export default function ConversationPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [participants, setParticipants] = useState<ConversationParticipant[]>([])
  const [convName, setConvName] = useState<string | null>(null)
  const [linkedListing, setLinkedListing] = useState<{ id: string; title: string; category: { icon: string } | null } | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/messages/${id}`)}`)
        return
      }
      const uid = user.id
      setUserId(uid)

      // Vérifie l'accès en cherchant la participation de l'utilisateur
      // (évite la double RLS : conversations → conversation_participants auto-référentielle)
      const { data: myPart, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, visible_from')
        .eq('conversation_id', id)
        .eq('user_id', uid)
        .maybeSingle()

      if (partError || !myPart) { setNotFound(true); setLoading(false); return }

      // Récupère le nom de la conversation (best-effort, non bloquant si RLS)
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, name')
        .eq('id', id)
        .maybeSingle()
      setConvName(conv?.name ?? null)

      // Fetch the listing linked to this conversation (if any)
      const { data: listing } = await supabase
        .from('listings')
        .select('id, title, categories(icon)')
        .eq('conversation_id', id)
        .maybeSingle()
      if (listing) {
        setLinkedListing({
          id: listing.id,
          title: listing.title,
          category: Array.isArray(listing.categories)
            ? (listing.categories[0] as { icon: string } | null)
            : (listing.categories as unknown as { icon: string } | null),
        })
      }

      // Participants avec profil
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, last_read_at, joined_at, profiles(id, username, full_name, avatar_url, avatar_color)')
        .eq('conversation_id', id)
      setParticipants((parts ?? []) as unknown as ConversationParticipant[])

      // Messages (50 derniers) — filtrés par visible_from si défini
      let msgsQuery = supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, profiles(id, username, full_name, avatar_url)')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
        .limit(50)
      if (myPart.visible_from) {
        msgsQuery = msgsQuery.gte('created_at', myPart.visible_from)
      }
      const { data: msgs } = await msgsQuery
      setMessages((msgs ?? []) as unknown as DirectMessage[])

      setLoading(false)
      scrollToBottom()

      // Marquer comme lu
      await supabase.rpc('mark_conversation_read', { conv_id: id })
    }
    init()
  }, [id])

  // Realtime : nouveaux messages
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`conv:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, async (payload) => {
        const newMsg = payload.new as DirectMessage
        // Récupère le profil du sender si ce n'est pas nous
        if (newMsg.sender_id !== userId) {
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single()
          newMsg.profiles = sender as Profile | undefined
        }
        setMessages(prev => [...prev, newMsg])
        scrollToBottom()
        // Marquer comme lu si la fenêtre est active
        if (document.visibilityState === 'visible') {
          await supabase.rpc('mark_conversation_read', { conv_id: id })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, id])

  const handleSend = async () => {
    if (!input.trim() || !userId || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    inputRef.current?.focus()

    // Optimistic insert
    const tempMsg: DirectMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: id,
      sender_id: userId,
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])
    scrollToBottom()

    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: userId,
      content,
    })

    if (error) {
      // Retire le message optimiste en cas d'erreur
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
    }
    setSending(false)
  }

  const handleDelete = async (msgId: string) => {
    // Suppression optimiste
    setMessages(prev => prev.filter(m => m.id !== msgId))
    const { error } = await supabase.from('messages').delete().eq('id', msgId)
    if (error) {
      // Rollback : recharge les messages depuis la BDD
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, profiles(id, username, full_name, avatar_url)')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
        .limit(50)
      if (msgs) setMessages(msgs as unknown as DirectMessage[])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Helpers affichage
  const others = participants.filter(p => p.user_id !== userId)
  const isGroup = others.length > 1
  const headerName = convName
    || (isGroup
      ? others.map(p => (p.profiles as Profile | undefined)?.full_name || (p.profiles as Profile | undefined)?.username).filter(Boolean).join(', ')
      : ((others[0]?.profiles as Profile | undefined)?.full_name || (others[0]?.profiles as Profile | undefined)?.username || 'Conversation'))

  const getParticipantName = (senderId: string) => {
    if (senderId === userId) return 'Vous'
    const p = participants.find(p => p.user_id === senderId)
    const profile = p?.profiles as Profile | undefined
    return profile?.full_name || profile?.username || 'Utilisateur'
  }

  const getInitial = (senderId: string) => {
    const name = getParticipantName(senderId)
    return name === 'Vous' ? 'V' : name[0]?.toUpperCase() || '?'
  }

  const getParticipantAvatarColor = (senderId: string) => {
    const p = participants.find(p => p.user_id === senderId)
    return (p?.profiles as Profile | undefined)?.avatar_color
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-400">
        <p className="text-lg font-medium mb-4">Conversation introuvable</p>
        <Link href="/messages" className="text-brand-600 hover:underline text-sm">← Retour aux messages</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <Link href="/messages" className="text-gray-500 hover:text-gray-700 flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={isGroup ? { backgroundColor: '#f3e8ff', color: '#6b21a8' } : getAvatarStyle((others[0]?.profiles as Profile | undefined)?.avatar_color)}
        >
          {isGroup ? <Users size={16} /> : (headerName[0]?.toUpperCase() || '?')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{headerName}</p>
          <p className="text-xs text-gray-400">
            {participants.length} participant{participants.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Listing banner */}
      {linkedListing && (
        <Link
          href={`/listings/${linkedListing.id}`}
          className="flex items-center gap-2.5 px-4 py-2.5 bg-brand-50 border-b border-brand-100 hover:bg-brand-100 transition-colors flex-shrink-0"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0 text-base">
            {linkedListing.category?.icon ?? <Package size={14} className="text-brand-600" />}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-brand-500 uppercase tracking-wide leading-none mb-0.5">Annonce liée</p>
            <p className="text-sm font-semibold text-brand-700 truncate">{linkedListing.title}</p>
          </div>
          <span className="ml-auto text-brand-400 text-xs flex-shrink-0">→</span>
        </Link>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <UserCircle2 size={40} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Commencez la conversation !</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === userId
          const prevMsg = messages[i - 1]
          const isSameAuthor = prevMsg && prevMsg.sender_id === msg.sender_id
          const showSender = !isMe && isGroup && !isSameAuthor

          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMe={isMe}
              isGroup={isGroup}
              isSameAuthor={!!isSameAuthor}
              showSender={showSender}
              senderName={getParticipantName(msg.sender_id)}
              senderInitial={getInitial(msg.sender_id)}
              senderAvatarColor={getParticipantAvatarColor(msg.sender_id)}
              onDelete={handleDelete}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrivez un message…"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
