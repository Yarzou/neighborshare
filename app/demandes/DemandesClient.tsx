'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { DirectMessage, Profile } from '@/lib/types'
import { cn, formatDate, getAvatarStyle, SIDE_PANE_WIDTH } from '@/lib/utils'
import { fetchRecentMessages } from '@/lib/messaging'
import {
  Loader2, MessageCircle, CheckCircle, XCircle, ArrowRight, Package, Inbox, ExternalLink,
} from 'lucide-react'
import { StatusBadge } from '@/components/listings/StatusBadge'

interface DemandeListing {
  id: string
  title: string
  description: string | null
  image_url: string | null
  status: 'en_cours' | 'validee'
  type: string
  conversation_id: string | null
  updated_at: string
  categories: { icon: string; label: string } | null
  other_profile: Profile | null
}

type Role = 'owner' | 'responder'

const profileNameOf = (item: DemandeListing) =>
  item.other_profile?.full_name || item.other_profile?.username || 'Voisin'

/**
 * Boutons d'action d'une demande : valider / refuser côté propriétaire,
 * clôturer côté demandeur. La logique RPC + notification est ici, partagée par
 * la carte mobile et le panneau de détail desktop — un seul endroit à corriger.
 */
function DemandeActions({
  item,
  role,
  onAction,
  variant,
}: {
  item: DemandeListing
  role: Role
  onAction: () => void
  /** `card` : boutons compacts en ligne (mobile) · `detail` : pleine largeur, empilés (desktop) */
  variant: 'card' | 'detail'
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)

  const run = async (action: string, rpc: string, event?: string) => {
    setLoading(action)
    const { error } = await supabase.rpc(rpc, { p_listing_id: item.id })
    if (error) { setLoading(null); return }
    if (event) {
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: item.id, event }),
      }).catch(console.error)
    }
    setLoading(null)
    onAction()
  }

  const detail = variant === 'detail'
  const base = cn(
    'flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:opacity-50',
    detail ? 'w-full py-2.5 text-sm' : 'flex-1 py-2 text-xs',
  )
  const spinner = <Loader2 size={detail ? 14 : 12} className="animate-spin" />

  return (
    <div className={cn('flex gap-2', detail && 'flex-col')}>
      {item.conversation_id && !detail && (
        <Link
          href={`/messages/${item.conversation_id}`}
          className={cn(base, 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-100')}
        >
          <MessageCircle size={13} /> Conversation
        </Link>
      )}

      {role === 'owner' && item.status === 'en_cours' && (
        <>
          <button
            onClick={() => run('validate', 'validate_listing_response', 'accepted')}
            disabled={loading !== null}
            className={cn(base, 'bg-green-600 text-white hover:bg-green-700')}
          >
            {loading === 'validate' ? spinner : <CheckCircle size={detail ? 15 : 13} />}
            {detail ? 'Valider la demande' : 'Valider'}
          </button>
          <button
            onClick={() => run('cancel', 'cancel_listing_response', 'refused')}
            disabled={loading !== null}
            className={cn(base, 'border border-gray-200 text-gray-500 hover:bg-gray-50')}
          >
            {loading === 'cancel' ? spinner : <XCircle size={detail ? 15 : 13} />}
            Refuser
          </button>
        </>
      )}

      {role === 'responder' && item.status === 'en_cours' && (
        <button
          onClick={() => run('cancel', 'cancel_listing_response', 'cancelled')}
          disabled={loading !== null}
          className={cn(base, 'border border-red-200 text-red-600 hover:bg-red-50')}
        >
          {loading === 'cancel' ? spinner : <XCircle size={detail ? 15 : 13} />}
          Clôturer ma demande
        </button>
      )}

      {role === 'owner' && item.status === 'validee' && (
        <button
          onClick={() => run('cancel', 'cancel_listing_response')}
          disabled={loading !== null}
          className={cn(base, 'border border-red-200 text-red-600 hover:bg-red-50')}
        >
          {loading === 'cancel' ? spinner : <XCircle size={detail ? 15 : 13} />}
          Annuler la validation
        </button>
      )}

      {role === 'responder' && item.status === 'validee' && (
        <button
          onClick={() => run('cancel', 'cancel_listing_response', 'cancelled')}
          disabled={loading !== null}
          className={cn(base, 'border border-red-200 text-red-600 hover:bg-red-50')}
        >
          {loading === 'cancel' ? spinner : <XCircle size={detail ? 15 : 13} />}
          Clôturer ma demande
        </button>
      )}
    </div>
  )
}

// ─── Mobile : cartes empilées (inchangé) ─────────────────────────────────────

function DemandeCard({
  item,
  role,
  onAction,
}: {
  item: DemandeListing
  role: Role
  onAction: () => void
}) {
  const profileName = profileNameOf(item)
  const profileInitial = profileName[0]?.toUpperCase() ?? '?'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <Link
        href={`/listings/${item.id}`}
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-xl flex-shrink-0">
          {item.categories?.icon ?? <Package size={18} className="text-brand-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{item.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.categories?.label ?? 'Annonce'}</p>
        </div>
        <StatusBadge status={item.status} />
        <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
      </Link>

      {/* Other party */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={getAvatarStyle(item.other_profile?.avatar_color)}
        >
          {profileInitial}
        </div>
        <span className="text-sm text-gray-600">
          {role === 'owner' ? 'Demandé par' : 'Proposé par'}{' '}
          <span className="font-medium text-gray-900">{profileName}</span>
        </span>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4">
        <DemandeActions item={item} role={role} onAction={onAction} variant="card" />
      </div>
    </div>
  )
}

function Section({
  title,
  items,
  role,
  emptyText,
  onAction,
}: {
  title: string
  items: DemandeListing[]
  role: Role
  emptyText: string
  onAction: () => void
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <p className="text-sm">{emptyText}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">{title}</h3>
      {items.map((item) => (
        <DemandeCard key={item.id} item={item} role={role} onAction={onAction} />
      ))}
    </div>
  )
}

// ─── Desktop : liste à gauche, détail à droite ───────────────────────────────

function DemandeListItem({
  item,
  role,
  selected,
  onSelect,
}: {
  item: DemandeListing
  role: Role
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-gray-100 transition-colors',
        selected ? 'bg-brand-50 shadow-[inset_3px_0_0_theme(colors.brand.600)]' : 'hover:bg-gray-50',
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-xl flex-shrink-0">
        {item.categories?.icon ?? <Package size={18} className="text-brand-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{item.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {profileNameOf(item)} · {item.status === 'en_cours'
            ? (role === 'owner' ? 'à traiter' : 'en attente')
            : 'validée'}
        </p>
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5">{formatDate(item.updated_at)}</span>
    </button>
  )
}

/**
 * Panneau de détail (desktop) : l'annonce, le voisin, les derniers échanges et
 * la décision. Les messages sont un simple aperçu — la vraie conversation reste
 * sur `/messages/[id]`, avec son Realtime.
 */
function DemandeDetail({
  item,
  role,
  userId,
  onAction,
}: {
  item: DemandeListing
  role: Role
  userId: string
  onAction: () => void
}) {
  const supabase = createClient()
  const [preview, setPreview] = useState<DirectMessage[] | null>(null)

  // Faux positif set-state-in-effect : le setState est après await.
  useEffect(() => {
    let cancelled = false
    setPreview(null) // eslint-disable-line react-hooks/set-state-in-effect
    if (!item.conversation_id) return
    fetchRecentMessages(supabase, item.conversation_id).then(msgs => {
      if (!cancelled) setPreview(msgs.slice(-4))
    })
    return () => { cancelled = true }
  }, [item.conversation_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const profileName = profileNameOf(item)
  const profileInitial = profileName[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex flex-col gap-5 p-5 lg:p-7 overflow-y-auto h-full">
      {/* Annonce */}
      <div className="flex items-start gap-5">
        <div className="w-[120px] h-[120px] rounded-2xl bg-brand-50 flex items-center justify-center text-5xl flex-shrink-0 overflow-hidden">
          {item.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={item.image_url} alt="" className="w-full h-full object-cover" />
            : (item.categories?.icon ?? <Package size={36} className="text-brand-500" />)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2.5 py-0.5 text-xs font-semibold">
              {item.categories?.label ?? 'Annonce'}
            </span>
            <StatusBadge status={item.status} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{item.title}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {role === 'owner' ? 'Votre annonce' : `Annonce de ${profileName}`} · mise à jour {formatDate(item.updated_at).toLowerCase()}
          </p>
          {item.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{item.description}</p>
          )}
        </div>
        <Link
          href={`/listings/${item.id}`}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-brand-300 hover:text-brand-700 transition-colors"
        >
          Voir l&apos;annonce <ExternalLink size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start flex-1 min-h-0">
        {/* Voisin + aperçu de la conversation */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden min-h-[260px]">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={getAvatarStyle(item.other_profile?.avatar_color)}
            >
              {profileInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{profileName}</p>
              <p className="text-xs text-gray-400">
                {role === 'owner' ? 'a demandé votre annonce' : 'propose cette annonce'}
              </p>
            </div>
            {item.other_profile?.id && (
              <Link href={`/profil/${item.other_profile.id}`} className="text-xs text-brand-700 hover:underline">
                Profil
              </Link>
            )}
          </div>

          <div className="flex-1 bg-gray-50 px-4 py-4 flex flex-col gap-2">
            {!item.conversation_id ? (
              <p className="text-sm text-gray-400 text-center my-auto">Aucune conversation liée.</p>
            ) : preview === null ? (
              <Loader2 size={18} className="animate-spin text-brand-600 mx-auto my-auto" />
            ) : preview.length === 0 ? (
              <p className="text-sm text-gray-400 text-center my-auto">Pas encore de message.</p>
            ) : preview.map(msg => {
              if (msg.is_system) {
                return (
                  <span key={msg.id} className="self-center text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
                    {msg.content}
                  </span>
                )
              }
              const isMe = msg.sender_id === userId
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed',
                    isMe ? 'self-end bg-brand-600 text-white rounded-br-md' : 'self-start bg-white border border-gray-200 text-gray-800 rounded-bl-md',
                  )}
                >
                  {msg.content}
                </div>
              )
            })}
          </div>

          {item.conversation_id && (
            <Link
              href={`/messages/${item.conversation_id}`}
              className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-gray-200 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
            >
              <MessageCircle size={15} /> Ouvrir la conversation
            </Link>
          )}
        </div>

        {/* Décision */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-900">Décision</p>
            <DemandeActions item={item} role={role} onAction={onAction} variant="detail" />
            <p className="text-xs text-gray-400 leading-relaxed">
              {role === 'owner' && item.status === 'en_cours' && `Valider passe l'annonce en « Validée » et prévient ${profileName} par notification.`}
              {role === 'owner' && item.status === 'validee' && 'Annuler la validation remet l\'annonce en cours de demande.'}
              {role === 'responder' && item.status === 'en_cours' && `${profileName} n'a pas encore répondu à votre demande.`}
              {role === 'responder' && item.status === 'validee' && 'Clôturer libère l\'annonce une fois l\'échange terminé.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DemandesClient() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'received' | 'sent'>('received')
  /** Demande ouverte dans le panneau de détail (desktop uniquement) */
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Received: I am the listing owner
  const [received, setReceived] = useState<DemandeListing[]>([])
  // Sent: I am the responder
  const [sent, setSent] = useState<DemandeListing[]>([])

  const load = async (uid: string) => {
    const [{ data: receivedRaw }, { data: sentRaw }] = await Promise.all([
      // Listings I own with active requests
      supabase
        .from('listings')
        .select('id, title, description, image_url, status, type, conversation_id, updated_at, categories(icon, label), responder_profile:profiles!listings_responder_id_fkey(id, username, full_name, avatar_url, avatar_color)')
        .eq('user_id', uid)
        .in('status', ['en_cours', 'validee'])
        .order('updated_at', { ascending: false }),
      // Listings I requested
      supabase
        .from('listings')
        .select('id, title, description, image_url, status, type, conversation_id, updated_at, categories(icon, label), owner_profile:profiles!listings_user_id_fkey(id, username, full_name, avatar_url, avatar_color)')
        .eq('responder_id', uid)
        .in('status', ['en_cours', 'validee'])
        .order('updated_at', { ascending: false }),
    ])

    const toItem = (r: any, other: Profile | null): DemandeListing => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      image_url: r.image_url ?? null,
      status: r.status,
      type: r.type,
      conversation_id: r.conversation_id,
      updated_at: r.updated_at,
      categories: r.categories,
      other_profile: other,
    })

    setReceived((receivedRaw ?? []).map((r: any) => toItem(r, r.responder_profile)))
    setSent((sentRaw ?? []).map((r: any) => toItem(r, r.owner_profile)))
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login?redirect=%2Fdemandes')
        return
      }
      setUserId(user.id)
      await load(user.id)
      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = () => {
    if (userId) load(userId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  const receivedPending = received.filter(r => r.status === 'en_cours')
  const receivedDone = received.filter(r => r.status === 'validee')
  const sentPending = sent.filter(r => r.status === 'en_cours')
  const sentDone = sent.filter(r => r.status === 'validee')

  const receivedBadge = received.length
  const sentBadge = sent.length

  // Desktop : la liste de l'onglet courant, et la demande ouverte — la première
  // par défaut, ou la précédente si elle existe encore après un rechargement.
  const currentList = tab === 'received' ? received : sent
  const currentRole: Role = tab === 'received' ? 'owner' : 'responder'
  const selected = currentList.find(i => i.id === selectedId) ?? currentList[0] ?? null

  const selectTab = (next: 'received' | 'sent') => {
    setTab(next)
    setSelectedId(null)
  }

  const tabButton = (key: 'received' | 'sent', label: string, badge: number, badgeColor: string) => (
    <button
      onClick={() => selectTab(key)}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
        tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      {badge > 0 && (
        <span className={`min-w-[18px] h-[18px] px-1 ${badgeColor} text-white text-[10px] font-bold rounded-full flex items-center justify-center`}>
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <>
      {/* ── Mobile : onglets + cartes empilées ── */}
      <div className="md:hidden max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mes demandes</h1>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
          {tabButton('received', 'Reçues', receivedBadge, 'bg-red-500')}
          {tabButton('sent', 'Envoyées', sentBadge, 'bg-amber-400')}
        </div>

        {tab === 'received' && (
          <div className="flex flex-col gap-6">
            <Section title="En attente de votre réponse" items={receivedPending} role="owner"
              emptyText="Aucune demande en attente" onAction={reload} />
            {receivedDone.length > 0 && (
              <Section title="Demandes validées" items={receivedDone} role="owner" emptyText="" onAction={reload} />
            )}
            {received.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📥</div>
                <p className="font-medium text-gray-500">Aucune demande reçue</p>
                <p className="text-sm mt-1">Les demandes sur vos annonces apparaîtront ici</p>
              </div>
            )}
          </div>
        )}

        {tab === 'sent' && (
          <div className="flex flex-col gap-6">
            <Section title="En attente de réponse" items={sentPending} role="responder"
              emptyText="Aucune demande en attente" onAction={reload} />
            {sentDone.length > 0 && (
              <Section title="Demandes acceptées" items={sentDone} role="responder" emptyText="" onAction={reload} />
            )}
            {sent.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📤</div>
                <p className="font-medium text-gray-500">Aucune demande envoyée</p>
                <p className="text-sm mt-1">Contactez une annonce pour démarrer une demande</p>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
                >
                  Explorer les annonces
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop : liste à gauche, détail à droite (même schéma que la carte) ── */}
      <div className="hidden md:flex h-[calc(100dvh-4rem)]">
        <aside className={cn('flex-shrink-0 bg-surface-pane border-r border-edge flex flex-col', SIDE_PANE_WIDTH)}>
          <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
            <h1 className="text-xl font-bold text-gray-900">Mes demandes</h1>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {tabButton('received', `Reçues · ${receivedBadge}`, receivedPending.length, 'bg-red-500')}
              {tabButton('sent', `Envoyées · ${sentBadge}`, sentPending.length, 'bg-amber-400')}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {currentList.length === 0 ? (
              <div className="text-center py-16 px-6 text-gray-400">
                <Inbox size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-500">
                  {tab === 'received' ? 'Aucune demande reçue' : 'Aucune demande envoyée'}
                </p>
                <p className="text-sm mt-1">
                  {tab === 'received'
                    ? 'Les demandes sur vos annonces apparaîtront ici'
                    : 'Contactez une annonce pour démarrer une demande'}
                </p>
              </div>
            ) : currentList.map(item => (
              <DemandeListItem
                key={item.id}
                item={item}
                role={currentRole}
                selected={selected?.id === item.id}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
          </div>
        </aside>

        <section className="flex-1 min-w-0 bg-gray-50">
          {selected ? (
            <DemandeDetail key={selected.id} item={selected} role={currentRole} userId={userId!} onAction={reload} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 px-6 text-center">
              <Inbox size={40} className="mb-3 opacity-20" />
              <p className="font-medium text-gray-500">Aucune demande à afficher</p>
              {tab === 'sent' && (
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
                >
                  Explorer les annonces
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
