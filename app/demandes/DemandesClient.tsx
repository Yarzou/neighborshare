'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { getAvatarStyle } from '@/lib/utils'
import { Loader2, MessageCircle, CheckCircle, XCircle, Clock, ArrowRight, Package } from 'lucide-react'

interface DemandeListing {
  id: string
  title: string
  status: 'en_cours' | 'validee'
  type: string
  conversation_id: string | null
  categories: { icon: string; label: string } | null
  other_profile: Profile | null
}

function StatusBadge({ status }: { status: 'en_cours' | 'validee' }) {
  if (status === 'en_cours') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
        <Clock size={10} /> En attente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
      <CheckCircle size={10} /> Validée
    </span>
  )
}

function DemandeCard({
  item,
  role,
  userId,
  onAction,
}: {
  item: DemandeListing
  role: 'owner' | 'responder'
  userId: string
  onAction: () => void
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

  const profileName = item.other_profile?.full_name || item.other_profile?.username || 'Voisin'
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
      <div className="flex gap-2 px-4 pb-4">
        {item.conversation_id && (
          <Link
            href={`/messages/${item.conversation_id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 transition-colors border border-brand-100"
          >
            <MessageCircle size={13} /> Conversation
          </Link>
        )}

        {/* Owner actions */}
        {role === 'owner' && item.status === 'en_cours' && (
          <>
            <button
              onClick={() => run('validate', 'validate_listing_response', 'accepted')}
              disabled={loading !== null}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading === 'validate' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={13} />}
              Valider
            </button>
            <button
              onClick={() => run('cancel', 'cancel_listing_response', 'refused')}
              disabled={loading !== null}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading === 'cancel' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
              Refuser
            </button>
          </>
        )}

        {/* Responder: cancel own request */}
        {role === 'responder' && item.status === 'en_cours' && (
          <button
            onClick={() => run('cancel', 'cancel_listing_response', 'cancelled')}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {loading === 'cancel' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
            Annuler ma demande
          </button>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  items,
  role,
  userId,
  emptyText,
  onAction,
}: {
  title: string
  items: DemandeListing[]
  role: 'owner' | 'responder'
  userId: string
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
        <DemandeCard key={item.id} item={item} role={role} userId={userId} onAction={onAction} />
      ))}
    </div>
  )
}

export default function DemandesClient() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'received' | 'sent'>('received')

  // Received: I am the listing owner
  const [received, setReceived] = useState<DemandeListing[]>([])
  // Sent: I am the responder
  const [sent, setSent] = useState<DemandeListing[]>([])

  const load = async (uid: string) => {
    const [{ data: receivedRaw }, { data: sentRaw }] = await Promise.all([
      // Listings I own with active requests
      supabase
        .from('listings')
        .select('id, title, status, type, conversation_id, categories(icon, label), responder_profile:profiles!listings_responder_id_fkey(id, username, full_name, avatar_url, avatar_color)')
        .eq('user_id', uid)
        .in('status', ['en_cours', 'validee'])
        .order('updated_at', { ascending: false }),
      // Listings I requested
      supabase
        .from('listings')
        .select('id, title, status, type, conversation_id, categories(icon, label), owner_profile:profiles!listings_user_id_fkey(id, username, full_name, avatar_url, avatar_color)')
        .eq('responder_id', uid)
        .in('status', ['en_cours', 'validee'])
        .order('updated_at', { ascending: false }),
    ])

    setReceived(
      (receivedRaw ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        type: r.type,
        conversation_id: r.conversation_id,
        categories: r.categories,
        other_profile: r.responder_profile,
      }))
    )

    setSent(
      (sentRaw ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        type: r.type,
        conversation_id: r.conversation_id,
        categories: r.categories,
        other_profile: r.owner_profile,
      }))
    )
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
  }, [])

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

  const receivedBadge = receivedPending.length
  const sentBadge = sentPending.length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mes demandes</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        <button
          onClick={() => setTab('received')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'received'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Reçues
          {receivedBadge > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {receivedBadge}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'sent'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Envoyées
          {sentBadge > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {sentBadge}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {tab === 'received' && (
        <div className="flex flex-col gap-6">
          <Section
            title="En attente de votre réponse"
            items={receivedPending}
            role="owner"
            userId={userId!}
            emptyText="Aucune demande en attente"
            onAction={reload}
          />
          {receivedDone.length > 0 && (
            <Section
              title="Demandes validées"
              items={receivedDone}
              role="owner"
              userId={userId!}
              emptyText=""
              onAction={reload}
            />
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
          <Section
            title="En attente de réponse"
            items={sentPending}
            role="responder"
            userId={userId!}
            emptyText="Aucune demande en attente"
            onAction={reload}
          />
          {sentDone.length > 0 && (
            <Section
              title="Demandes acceptées"
              items={sentDone}
              role="responder"
              userId={userId!}
              emptyText=""
              onAction={reload}
            />
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
  )
}
