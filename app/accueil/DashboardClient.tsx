'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Search, ChevronRight, ChartColumn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePendingRequests } from '@/lib/hooks'
import { CATEGORY_LIST } from '@/lib/categories'
import { formatDate } from '@/lib/utils'
import type { ListingStatus, ListingType } from '@/lib/types'
import { CategoryTile } from '@/components/listings/CategoryIcon'
import { TypeBadge } from '@/components/listings/TypeBadge'

interface Props {
  firstName: string | null
}

interface ListingRow { id: string; title: string; type: ListingType; status: ListingStatus; category_id: number | null; created_at: string }
interface EventRow { id: string; title: string; event_date: string; location_text: string | null }
interface PollRow { id: string; question: string; closes_at: string | null }

/** Carte blanche sur fond gris, ombre à peine visible (maquette « Verre et Cèdre »). */
const CARD = 'bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
const SECTION_TITLE = 'text-xl font-bold tracking-tight text-gray-900'

const categoryLabel = (id: number | null) => CATEGORY_LIST.find(c => c.id === id)?.filterLabel ?? 'Annonce'

/**
 * Accueil connecté, version allégée validée sur maquette le 2026-10-06 :
 * salutation, recherche, demandes en cours, « Près de chez vous » et une courte
 * liste « À venir » (prochain événement, sondage ouvert). Publier vit dans la
 * barre d'onglets ; les rubriques du quartier, dans l'onglet Quartier.
 *
 * Chaque bloc est lu côté client et se masque s'il est vide ou si sa table
 * manque encore sur la base (même dégradation silencieuse que /infos).
 */
export default function DashboardClient({ firstName }: Props) {
  const pendingRequestsCount = usePendingRequests()
  const [listings, setListings] = useState<ListingRow[]>([])
  const [nextEvent, setNextEvent] = useState<EventRow | null>(null)
  const [poll, setPoll] = useState<PollRow | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const now = new Date().toISOString()

    // La vue `listings_geo` exclut les annonces expirées ; la table sert de repli
    // tant que la migration 032 manque sur une base.
    const loadListings = async () => {
      const columns = 'id, title, type, status, category_id, created_at'
      const fromView = await supabase.from('listings_geo').select(columns)
        .eq('status', 'disponible').order('created_at', { ascending: false }).limit(8)
      if (!fromView.error) return fromView.data as ListingRow[]
      const fromTable = await supabase.from('listings').select(columns)
        .eq('status', 'disponible').order('created_at', { ascending: false }).limit(8)
      return (fromTable.data as ListingRow[] | null) ?? []
    }

    Promise.all([
      loadListings(),
      supabase.from('events').select('id, title, event_date, location_text')
        .gte('event_date', now).order('event_date').limit(1),
      supabase.from('polls').select('id, question, closes_at')
        .or(`closes_at.is.null,closes_at.gt.${now}`).order('created_at', { ascending: false }).limit(1),
    ]).then(([listingRows, eventRes, pollRes]) => {
      if (cancelled) return
      setListings(listingRows)
      setNextEvent(((eventRes.data as EventRow[] | null) ?? [])[0] ?? null)
      setPoll(((pollRes.data as PollRow[] | null) ?? [])[0] ?? null)
    })
    return () => { cancelled = true }
  }, [])

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const eventDate = nextEvent ? new Date(nextEvent.event_date) : null

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 md:pt-10 flex flex-col gap-3.5">
      {/* Pas de « + » ici (retiré à la demande, 2026-10-07) : on publie depuis la Carte. */}
      <header className="flex flex-col gap-0.5">
        {/* Date du navigateur : le serveur peut être sur un autre fuseau. */}
        <p suppressHydrationWarning className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">{today}</p>
        <h1 className="text-[34px] leading-10 font-bold tracking-tight text-gray-900">
          Bonjour{firstName ? ` ${firstName}` : ''}
        </h1>
      </header>

      {/* Champ de recherche façon iOS : il mène à la carte, où l'on filtre. */}
      <Link href="/map" className="h-10 px-3 rounded-[11px] bg-gray-200 text-gray-500 text-[17px] flex items-center gap-2 hover:bg-gray-300/60 transition-colors">
        <Search size={18} strokeWidth={2.3} />
        Rechercher dans le quartier
      </Link>

      {pendingRequestsCount > 0 && (
        <Link href="/demandes" className={`${CARD} flex items-center gap-3 px-3.5 py-3 hover:bg-gray-50 transition-colors`}>
          <span className="w-9 h-9 rounded-[10px] bg-brand-600 text-white flex items-center justify-center shrink-0">
            <ClipboardList size={19} />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-base font-semibold text-gray-900">
              {pendingRequestsCount} demande{pendingRequestsCount > 1 ? 's' : ''} en cours
            </span>
            <span className="text-[13px] text-gray-500">Prêts, dons et services à suivre</span>
          </span>
          <ChevronRight size={18} className="text-gray-400 shrink-0" />
        </Link>
      )}

      {listings.length > 0 && (
        <section className="flex flex-col gap-2.5 mt-1.5">
          <div className="flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>Près de chez vous</h2>
            <Link href="/map" className="text-[15px] text-brand-600 hover:text-brand-700">Tout voir</Link>
          </div>
          {/* 16 px de marge à gauche comme à droite, aussi après défilement :
              - scroll-px-4 : les cartes s'aimantent à 16 px du bord, pas contre l'écran ;
              - à droite, un espaceur plutôt qu'un padding, que Safari ignore en fin de
                zone défilante (6 px + l'écart de 10 px = 16 px). */}
          <div className="flex gap-2.5 overflow-x-auto -mx-4 pl-4 scroll-px-4 pb-1.5 snap-x">
            {listings.map(l => (
              <Link key={l.id} href={`/listings/${l.id}`}
                className={`${CARD} snap-start w-[150px] shrink-0 p-3 flex flex-col gap-2 hover:bg-gray-50 transition-colors`}>
                <CategoryTile id={l.category_id} type={l.type} size="sm" />
                <span className="text-[15px] leading-5 font-semibold text-gray-900 line-clamp-2 min-h-10">{l.title}</span>
                <span className="text-[13px] text-gray-500 truncate">{categoryLabel(l.category_id)} · {formatDate(l.created_at)}</span>
                <TypeBadge type={l.type} className="self-start" />
              </Link>
            ))}
            <span aria-hidden="true" className="w-1.5 shrink-0" />
          </div>
        </section>
      )}

      {(nextEvent || poll) && (
        <section className="flex flex-col gap-2.5">
          <h2 className={SECTION_TITLE}>À venir</h2>
          {/* Liste groupée façon iOS : séparateur décalé sous le texte, pas sous l'icône */}
          <div className={`${CARD} overflow-hidden`}>
            {nextEvent && eventDate && (
              <Link href={`/evenements/${nextEvent.id}`} className="flex items-center gap-3 pl-3 hover:bg-gray-50 transition-colors">
                <span suppressHydrationWarning className="w-9 h-10 rounded-[10px] bg-brand-600 text-white flex flex-col items-center justify-center leading-none shrink-0">
                  <span className="text-[9.5px] font-bold tracking-wider">{eventDate.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase()}</span>
                  <span className="text-[17px] font-bold">{eventDate.getDate()}</span>
                </span>
                <span className="flex-1 min-w-0 flex items-center gap-2 py-3 pr-3.5">
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-base font-semibold text-gray-900 truncate">{nextEvent.title}</span>
                    <span suppressHydrationWarning className="text-[13px] text-gray-500 truncate">
                      {eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}
                      {nextEvent.location_text ? ` · ${nextEvent.location_text}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-gray-400 shrink-0" />
                </span>
              </Link>
            )}
            {poll && (
              <Link href="/infos" className="flex items-center gap-3 pl-3 hover:bg-gray-50 transition-colors">
                <span className="w-9 h-9 rounded-[10px] bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                  <ChartColumn size={19} />
                </span>
                <span className={`flex-1 min-w-0 flex items-center gap-2 py-3 pr-3.5 ${nextEvent ? 'border-t border-gray-200' : ''}`}>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-base font-semibold text-gray-900 line-clamp-2">{poll.question}</span>
                    <span suppressHydrationWarning className="text-[13px] text-gray-500">
                      Sondage{poll.closes_at ? ` · jusqu'au ${new Date(poll.closes_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-gray-400 shrink-0" />
                </span>
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
