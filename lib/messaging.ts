import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConversationWithDetails,
  ConversationParticipant,
  DirectMessage,
} from '@/lib/types'

/**
 * Accès à la messagerie, regroupés ici parce qu'ils partagent tous le même
 * repli : tant que la migration 039 n'est pas appliquée, les fonctions
 * `conversations_overview()` et `unread_message_count()` n'existent pas en base
 * et il faut retomber sur les requêtes d'origine.
 *
 * Module **isomorphe** — pas de `'use client'`, le client Supabase est passé en
 * paramètre. Il peut donc être appelé depuis un composant client comme depuis un
 * Server Component, sans dupliquer la logique ni le repli.
 */

/** Nombre de messages chargés à l'ouverture d'une conversation. */
export const MESSAGES_PAGE_SIZE = 50

/**
 * Colonnes des messages. Pas d'embed `profiles(...)` : `MessageBubble` ne lit
 * jamais `msg.profiles` — le nom, l'initiale et la couleur d'avatar viennent
 * tous de `participants`. C'était une jointure payée à chaque chargement pour un
 * champ que rien ne rend.
 */
const MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, content, created_at, is_system, ' +
  'message_reactions(id, message_id, user_id, emoji, created_at)'

/* ────────────────────────────────────────────────────────────────────────────
 * Détection de l'absence des fonctions (migration 039 non appliquée)
 *
 * Même dispositif que `MapView` → `listings_within_radius`, avec une nuance :
 * PostgREST répond `PGRST202` quand la fonction est absente de son cache de
 * schéma. Ce cas-là est DÉFINITIF pour la durée de l'onglet, on le mémorise pour
 * ne pas payer un 404 avant chaque repli. Toute autre erreur (réseau, 5xx) est
 * traitée comme transitoire : on replie une fois, mais on retentera le RPC au
 * prochain appel.
 *
 * ⛔ Phase contract : supprimer ce drapeau, les fonctions *Legacy et leurs
 * appels, une fois 039 appliquée sur test ET prod.
 * ──────────────────────────────────────────────────────────────────────────── */

const rpcMissing = { overview: false, unread: false, pollResults: false }

interface PostgrestLikeError {
  code?: string
  message?: string
}

function isFunctionMissing(error: PostgrestLikeError | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || (error.message?.includes('schema cache') ?? false)
}

function warnFallback(what: string, error: PostgrestLikeError | null): void {
  console.warn(
    `[messagerie] ${what} indisponible (migration 039 non appliquée ?) — repli sur l'ancien chemin`,
    error?.message,
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Liste des conversations
 * ──────────────────────────────────────────────────────────────────────────── */

/** Une ligne de `conversations_overview()`. */
interface ConversationOverviewRow {
  conversation_id: string
  name: string | null
  created_at: string
  updated_at: string
  last_message_id: string | null
  last_message_content: string | null
  last_message_at: string | null
  last_sender_id: string | null
  last_message_is_system: boolean | null
  unread_count: number
  participants: ConversationParticipant[]
}

function rowToConversation(row: ConversationOverviewRow): ConversationWithDetails {
  const lastMessage: DirectMessage | null = row.last_message_id
    ? {
        id: row.last_message_id,
        conversation_id: row.conversation_id,
        sender_id: row.last_sender_id ?? '',
        content: row.last_message_content ?? '',
        created_at: row.last_message_at ?? row.updated_at,
        is_system: row.last_message_is_system ?? false,
      }
    : null

  return {
    id: row.conversation_id,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    participants: row.participants ?? [],
    lastMessage,
    unreadCount: Number(row.unread_count ?? 0),
  } as ConversationWithDetails
}

/**
 * Liste des conversations de l'utilisateur, prête à rendre.
 *
 * ⚠️ Différence assumée entre les deux chemins : le RPC renvoie le VRAI nombre
 * de non-lus par fil, là où le repli calcule un 0/1 à partir du seul dernier
 * message. `ConversationRow` ne teste que `unreadCount > 0`, aucun rendu ne
 * change — mais la valeur n'est exacte que sur le chemin RPC.
 */
export async function fetchConversationsOverview(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConversationWithDetails[]> {
  if (!rpcMissing.overview) {
    const { data, error } = await supabase.rpc('conversations_overview')
    if (!error && data) {
      return (data as ConversationOverviewRow[]).map(rowToConversation)
    }
    if (isFunctionMissing(error)) rpcMissing.overview = true
    warnFallback('conversations_overview', error)
  }
  return buildConversationsLegacy(supabase, userId)
}

/**
 * ⛔ Code de transition — à supprimer en phase contract.
 *
 * Reprise **à l'identique** du corps d'origine de `MessagesClient` : quatre
 * requêtes séquentielles, dont un `select` non borné sur `messages`. Ne pas
 * l'améliorer : son seul rôle est d'être le miroir exact du comportement de
 * production tant que la migration 039 n'est pas passée partout.
 */
async function buildConversationsLegacy(
  supabase: SupabaseClient,
  uid: string,
): Promise<ConversationWithDetails[]> {
  const { data: myParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at, visible_from')
    .eq('user_id', uid)
    .is('deleted_at', null)

  const convIds = (myParts ?? []).map(p => p.conversation_id)
  if (convIds.length === 0) return []

  const { data: convs } = await supabase
    .from('conversations')
    .select('id, name, created_at, updated_at')
    .in('id', convIds)
    .order('updated_at', { ascending: false })

  const { data: allParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id, last_read_at, joined_at, profiles(id, username, full_name, avatar_url, avatar_color)')
    .in('conversation_id', convIds)

  const { data: allMsgs } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  const partsMap: Record<string, ConversationParticipant[]> = {}
  for (const p of allParts ?? []) {
    if (!partsMap[p.conversation_id]) partsMap[p.conversation_id] = []
    partsMap[p.conversation_id].push(p as unknown as ConversationParticipant)
  }

  const visibleFromMap: Record<string, string | null> = {}
  for (const p of myParts ?? []) visibleFromMap[p.conversation_id] = p.visible_from ?? null

  const lastMsgMap: Record<string, DirectMessage> = {}
  for (const m of allMsgs ?? []) {
    if (lastMsgMap[m.conversation_id]) continue
    const visibleFrom = visibleFromMap[m.conversation_id]
    if (visibleFrom && new Date(m.created_at) < new Date(visibleFrom)) continue
    lastMsgMap[m.conversation_id] = m as DirectMessage
  }

  const lastReadMap: Record<string, string> = {}
  for (const p of myParts ?? []) lastReadMap[p.conversation_id] = p.last_read_at

  return (convs ?? []).map(conv => {
    const parts = partsMap[conv.id] ?? []
    const lastMsg = lastMsgMap[conv.id] ?? null
    const lastRead = lastReadMap[conv.id]
    const unread = lastMsg && lastMsg.sender_id !== uid && lastRead
      ? new Date(lastMsg.created_at) > new Date(lastRead) ? 1 : 0
      : 0
    return { ...conv, participants: parts, lastMessage: lastMsg, unreadCount: unread }
  }) as ConversationWithDetails[]
}

/* ────────────────────────────────────────────────────────────────────────────
 * Compteur de non-lus (pastille de la navbar, présente sur chaque page)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function fetchUnreadCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!rpcMissing.unread) {
    const { data, error } = await supabase.rpc('unread_message_count')
    if (!error && typeof data === 'number') return data
    if (isFunctionMissing(error)) rpcMissing.unread = true
    warnFallback('unread_message_count', error)
  }
  return unreadCountLegacy(supabase, userId)
}

/**
 * ⛔ Code de transition — à supprimer en phase contract.
 * Corps d'origine de `useUnreadCount`, déplacé sans modification.
 */
async function unreadCountLegacy(supabase: SupabaseClient, uid: string): Promise<number> {
  const { data: parts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at, visible_from')
    .eq('user_id', uid)
    .is('deleted_at', null)

  if (!parts || parts.length === 0) return 0

  const sinceMs = Math.min(...parts.map(p => new Date(p.last_read_at).getTime()))

  const { data: msgs } = await supabase
    .from('messages')
    .select('conversation_id, created_at')
    .in('conversation_id', parts.map(p => p.conversation_id))
    .neq('sender_id', uid)
    .gt('created_at', new Date(sinceMs).toISOString())

  if (!msgs) return 0

  const cutoffs = new Map(parts.map(p => [p.conversation_id, {
    lastRead: new Date(p.last_read_at).getTime(),
    visibleFrom: p.visible_from ? new Date(p.visible_from).getTime() : null,
  }]))

  return msgs.reduce((total, m) => {
    const cutoff = cutoffs.get(m.conversation_id)
    if (!cutoff) return total
    const at = new Date(m.created_at).getTime()
    if (at <= cutoff.lastRead) return total
    if (cutoff.visibleFrom !== null && at < cutoff.visibleFrom) return total
    return total + 1
  }, 0)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Messages d'une conversation
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Les {@link MESSAGES_PAGE_SIZE} messages les plus **récents**.
 *
 * ⚠️ Le tri part de `descending` et le tableau est inversé en mémoire. La forme
 * précédente — `.order('created_at', { ascending: true }).limit(50)` — renvoyait
 * les 50 PREMIERS messages du fil : `limit` s'applique après le tri, jamais
 * avant. Sur une conversation de plus de 50 messages, on l'ouvrait donc sur ses
 * tout premiers échanges, et rien de ce qui venait d'être écrit n'était visible.
 *
 * Le tri secondaire par `id` rend l'inversion déterministe quand deux messages
 * partagent le même `created_at`.
 */
export async function fetchRecentMessages(
  supabase: SupabaseClient,
  conversationId: string,
  visibleFrom?: string | null,
): Promise<DirectMessage[]> {
  let query = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE)

  if (visibleFrom) query = query.gte('created_at', visibleFrom)

  const { data } = await query

  return ((data ?? []) as unknown as (DirectMessage & { message_reactions?: DirectMessage['reactions'] })[])
    .slice()
    .reverse()
    .map(m => {
      const { message_reactions, ...rest } = m
      return { ...rest, reactions: message_reactions ?? [] }
    })
}

/* ────────────────────────────────────────────────────────────────────────────
 * Regroupement des rafraîchissements Realtime
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Coalesce les rafraîchissements déclenchés par le Realtime.
 *
 * Trois protections, dans cet ordre :
 *  - fenêtre glissante de `delayMs` : une rafale (un voisin qui envoie cinq
 *    messages, ou une conversation de groupe active) ne produit qu'un appel ;
 *  - un rafraîchissement déjà EN VOL n'est pas doublé — même raisonnement que
 *    `inFlight` dans `useSharedCounter` ;
 *  - un événement arrivé pendant le vol arme un unique passage supplémentaire,
 *    pour ne pas terminer sur un état périmé.
 */
export function createDebouncedRefresh(run: () => Promise<unknown>, delayMs = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<unknown> | null = null
  let pending = false

  const fire = () => {
    if (inFlight) { pending = true; return }
    inFlight = run().finally(() => {
      inFlight = null
      if (pending) { pending = false; fire() }
    })
  }

  return {
    schedule() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { timer = null; fire() }, delayMs)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      pending = false
    },
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Résultats de sondages (utilisé par /infos, exposé ici pour le repli partagé)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface PollResultRow {
  option_id: string
  label: string
  votes: number
}

/**
 * Résultats de plusieurs sondages en un appel.
 *
 * `PollsSection` lançait un `poll_results()` par sondage. Le repli reprend cette
 * boucle à l'identique tant que `poll_results_bulk` n'existe pas en base.
 *
 * Un sondage dont les résultats ne sont pas encore accessibles à l'appelant
 * (« visibles après avoir voté », migration 036) est simplement absent de la
 * table de retour — `poll_results()` lève, `poll_results_bulk` omet.
 */
export async function fetchPollResults(
  supabase: SupabaseClient,
  pollIds: string[],
): Promise<Record<string, PollResultRow[]>> {
  if (pollIds.length === 0) return {}

  if (!rpcMissing.pollResults) {
    const { data, error } = await supabase.rpc('poll_results_bulk', { p_poll_ids: pollIds })
    if (!error && data) {
      const grouped: Record<string, PollResultRow[]> = {}
      for (const row of data as (PollResultRow & { poll_id: string })[]) {
        ;(grouped[row.poll_id] ??= []).push({
          option_id: row.option_id,
          label: row.label,
          votes: Number(row.votes),
        })
      }
      return grouped
    }
    if (isFunctionMissing(error)) rpcMissing.pollResults = true
    warnFallback('poll_results_bulk', error)
  }

  // ⛔ Code de transition — un aller-retour par sondage.
  const grouped: Record<string, PollResultRow[]> = {}
  await Promise.all(pollIds.map(async id => {
    const { data } = await supabase.rpc('poll_results', { p_poll_id: id })
    if (data) grouped[id] = data as PollResultRow[]
  }))
  return grouped
}
