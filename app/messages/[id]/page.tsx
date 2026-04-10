'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Loader2, Users, UserCircle2 } from 'lucide-react'
import type { DirectMessage, ConversationParticipant, Profile } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function ConversationPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [participants, setParticipants] = useState<ConversationParticipant[]>([])
  const [convName, setConvName] = useState<string | null>(null)
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/messages/${id}`)}`)
        return
      }
      const uid = session.user.id
      setUserId(uid)

      // Vérifie que l'utilisateur est bien participant
      const { data: participation } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', id)
        .eq('user_id', uid)
        .single()

      if (!participation) { setNotFound(true); setLoading(false); return }

      // Conversation info
      const { data: conv } = await supabase
        .from('conversations')
        .select('name')
        .eq('id', id)
        .single()
      setConvName(conv?.name ?? null)

      // Participants avec profil
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, last_read_at, joined_at, profiles(id, username, full_name, avatar_url)')
        .eq('conversation_id', id)
      setParticipants((parts ?? []) as unknown as ConversationParticipant[])

      // Messages (50 derniers)
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, profiles(id, username, full_name, avatar_url)')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
        .limit(50)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">
        <p className="text-lg font-medium mb-4">Conversation introuvable</p>
        <Link href="/messages" className="text-brand-600 hover:underline text-sm">← Retour aux messages</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <Link href="/messages" className="text-gray-500 hover:text-gray-700 flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isGroup ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'}`}>
          {isGroup ? <Users size={16} /> : (headerName[0]?.toUpperCase() || '?')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{headerName}</p>
          <p className="text-xs text-gray-400">
            {participants.length} participant{participants.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

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
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar (autres participants, 1 seul affiché) */}
              {!isMe && (
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${isSameAuthor ? 'opacity-0' : 'bg-brand-100 text-brand-700'}`}>
                  {getInitial(msg.sender_id)}
                </div>
              )}

              <div className={`flex flex-col gap-0.5 max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                {showSender && (
                  <span className="text-xs text-gray-400 px-1">{getParticipantName(msg.sender_id)}</span>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'bg-brand-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                } ${msg.id.startsWith('temp-') ? 'opacity-60' : ''}`}>
                  {msg.content}
                </div>
                <span className="text-[11px] text-gray-400 px-1">{formatDate(msg.created_at)}</span>
              </div>
            </div>
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
          className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
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
