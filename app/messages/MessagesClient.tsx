'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Plus, Loader2 } from 'lucide-react'
import type { ConversationWithDetails } from '@/lib/types'
import { fetchConversationsOverview, createDebouncedRefresh } from '@/lib/messaging'
import { readPageCache, writePageCache } from '@/lib/pageCache'
import { ConversationRow } from '@/components/messages/ConversationRow'

/**
 * Liste des conversations. `userId` est résolu côté serveur (layout / page).
 *
 * Deux habillages pour un seul composant : page pleine largeur sur mobile,
 * volet de 360 px à défilement interne sur desktop (cf. `MessagesShell`). Le
 * fil ouvert est surligné à partir de l'URL.
 */
export default function MessagesClient({ userId }: { userId: string }) {
  const supabase = createClient()
  const pathname = usePathname()
  const activeId = pathname?.startsWith('/messages/') ? pathname.split('/')[2] ?? null : null

  // Cache de page (`lib/pageCache.ts`), propre à l'utilisateur : au retour sur
  // l'onglet, la liste s'affiche telle qu'on l'a laissée, puis se rafraîchit.
  const cacheKey = `messages:${userId}`
  const [cached] = useState(() => readPageCache<ConversationWithDetails[]>(cacheKey))
  const [loading, setLoading] = useState(!cached)
  const [conversations, setConversations] = useState<ConversationWithDetails[]>(cached ?? [])

  // Le cache suit la liste affichée, y compris une conversation qu'on vient de
  // supprimer (retirée tout de suite, sans attendre la base).
  useEffect(() => {
    if (!loading) writePageCache(cacheKey, conversations)
  }, [cacheKey, conversations, loading])

  /**
   * Une seule requête là où il y en avait quatre en séquence — dont un `select`
   * sur `messages` NON BORNÉ, qui ramenait tout l'historique de l'utilisateur
   * pour n'en extraire que le dernier message de chaque fil. Le regroupement se
   * fait maintenant en base (`conversations_overview`, migration 039), avec
   * repli automatique sur l'ancien chemin tant qu'elle n'est pas appliquée.
   */
  const refresh = useCallback(async () => {
    setConversations(await fetchConversationsOverview(supabase, userId))
  }, [supabase, userId])

  useEffect(() => {
    void refresh().finally(() => setLoading(false))
  }, [refresh])

  // Realtime : met à jour la liste à chaque nouveau message
  useEffect(() => {
    // Un rafraîchissement par message était intenable quand il coûtait quatre
    // requêtes ; il en coûte une désormais, mais une rafale (conversation de
    // groupe active) mérite toujours d'être regroupée.
    const refresher = createDebouncedRefresh(refresh, 400)

    const channel = supabase
      .channel('messages_list_updates')
      // Volontairement SANS filtre `conversation_id` : le Realtime applique le
      // RLS de `messages`, on ne reçoit donc que les fils dont on est
      // participant. Un filtre `in.(…)` devrait être reconstruit à chaque
      // nouvelle conversation — et manquerait justement le cas « quelqu'un
      // m'écrit pour la première fois ».
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => refresher.schedule())
      // La vue d'ensemble porte aussi les non-lus : une conversation lue depuis
      // un autre onglet (`mark_conversation_read` → `last_read_at`) doit faire
      // retomber la pastille ici aussi.
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        () => refresher.schedule())
      .subscribe()

    return () => {
      refresher.cancel()
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, refresh])

  const handleDeleteConversation = async (convId: string) => {
    // Soft delete : masque la conversation + mémorise la coupure d'historique
    const now = new Date().toISOString()
    setConversations(prev => prev.filter(c => c.id !== convId))
    const { error } = await supabase
      .from('conversation_participants')
      .update({ deleted_at: now, visible_from: now })
      .eq('conversation_id', convId)
      .eq('user_id', userId)
    if (error) {
      await refresh()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] md:min-h-0 md:h-full">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  const unread = conversations.filter(c => c.unreadCount > 0).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:max-w-none md:mx-0 md:px-0 md:py-0 md:h-full md:flex md:flex-col">
      <div className="flex items-center justify-between mb-6 md:mb-0 md:px-4 md:py-3.5 md:border-b md:border-edge md:flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-xl font-bold flex items-center gap-2">
            <MessageCircle className="text-brand-600 md:hidden" size={26} />
            Messages
          </h1>
          {unread > 0 && (
            <p className="hidden md:block text-xs text-gray-500 mt-0.5">
              {unread} non lue{unread > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Link
          href="/messages/new"
          className="flex items-center justify-center gap-1.5
                     w-10 h-10 rounded-full
                     sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:rounded-xl
                     md:px-3 md:py-2
                     bg-brand-600 text-white hover:bg-brand-700 transition-colors
                     text-sm font-medium flex-shrink-0"
          aria-label="Nouvelle conversation"
        >
          <Plus size={18} />
          <span className="hidden sm:inline md:hidden lg:inline">Nouvelle conversation</span>
          <span className="hidden md:inline lg:hidden">Nouvelle</span>
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200 md:border-0 md:rounded-none">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Aucune conversation pour l&apos;instant</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 md:gap-1 md:flex-1 md:overflow-y-auto md:p-2">
          {conversations.map(conv => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              userId={userId}
              active={conv.id === activeId}
              onDelete={handleDeleteConversation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
