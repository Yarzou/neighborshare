'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Plus, Search, ChevronRight, Megaphone, ChartColumn, ShoppingCart, Wrench, FileText } from 'lucide-react'
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
interface AnnouncementRow { id: string; title: string; created_at: string }

/** Carte blanche sur fond gris, ombre à peine visible (maquette « Verre et Cèdre »). */
const CARD = 'bg-white rounded-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
const SECTION_TITLE = 'text-xl font-bold tracking-tight text-gray-900'

const categoryLabel = (id: number | null) => CATEGORY_LIST.find(c => c.id === id)?.filterLabel ?? 'Annonce'

/**
 * Accueil connecté, refonte « Verre et Cèdre » (2026-10-06, maquette validée) :
 * salutation, demandes en attente, deux actions (Proposer / Chercher), puis ce
 * qui se passe dans le quartier — dernières annonces, prochains événements,
 * vie du quartier.
 *
 * Chaque bloc est lu côté client et se masque s'il est vide ou si sa table
 * manque encore sur la base (même dégradation silencieuse que /infos) : la page
 * ne casse jamais pour une section.
 */
export default function DashboardClient({ firstName }: Props) {
  const pendingRequestsCount = usePendingRequests()
  const [listings, setListings] = useState<ListingRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [poll, setPoll] = useState<PollRow | null>(null)
  const [announcement, setAnnouncement] = useState<AnnouncementRow | null>(null)

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
        .gte('event_date', now).order('event_date').limit(2),
      supabase.from('polls').select('id, question, closes_at')
        .or(`closes_at.is.null,closes_at.gt.${now}`).order('created_at', { ascending: false }).limit(1),
      supabase.from('announcements').select('id, title, created_at')
        .order('created_at', { ascending: false }).limit(1),
    ]).then(([listingRows, eventRes, pollRes, annRes]) => {
      if (cancelled) return
      setListings(listingRows)
      setEvents((eventRes.data as EventRow[] | null) ?? [])
      setPoll(((pollRes.data as PollRow[] | null) ?? [])[0] ?? null)
      setAnnouncement(((annRes.data as AnnouncementRow[] | null) ?? [])[0] ?? null)
    })
    return () => { cancelled = true }
  }, [])

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 md:pt-10 flex flex-col gap-5">
      <header className="flex flex-col gap-0.5">
        {/* Date du navigateur : le serveur peut être sur un autre fuseau. */}
        <p suppressHydrationWarning className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">{today}</p>
        <h1 className="text-[34px] leading-10 font-bold tracking-tight text-gray-900">
          Bonjour{firstName ? ` ${firstName}` : ''}
        </h1>
      </header>

      {pendingRequestsCount > 0 && (
        <Link href="/demandes" className={`${CARD} flex items-center gap-3 p-3.5 hover:bg-gray-50 transition-colors`}>
          <span className="w-10 h-10 rounded-[11px] bg-brand-600 text-white flex items-center justify-center shrink-0">
            <ClipboardList size={21} />
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

      <div className="grid grid-cols-2 gap-3">
        <Link href="/listings/new"
          className="flex flex-col gap-3 p-4 rounded-[18px] bg-brand-600 hover:bg-brand-700 text-white shadow-[0_6px_16px_rgba(16,52,32,0.18)] transition-colors">
          <span className="w-[38px] h-[38px] rounded-[11px] bg-white/20 flex items-center justify-center">
            <Plus size={22} strokeWidth={2.4} />
          </span>
          <span className="flex flex-col">
            <span className="text-[17px] font-semibold">Proposer</span>
            <span className="text-[13px]">Prêter, donner, aider</span>
          </span>
        </Link>
        <Link href="/map" className={`${CARD} flex flex-col gap-3 p-4 hover:bg-gray-50 transition-colors`}>
          <span className="w-[38px] h-[38px] rounded-[11px] bg-brand-100 text-brand-700 flex items-center justify-center">
            <Search size={21} strokeWidth={2.2} />
          </span>
          <span className="flex flex-col">
            <span className="text-[17px] font-semibold text-gray-900">Chercher</span>
            <span className="text-[13px] text-gray-500">Un outil, un trajet…</span>
          </span>
        </Link>
      </div>

      {listings.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>Près de chez vous</h2>
            <Link href="/map" className="text-[15px] text-brand-600 hover:text-brand-700">Voir la carte</Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto -mx-4 px-4 pb-1.5 snap-x">
            {listings.map(l => (
              <Link key={l.id} href={`/listings/${l.id}`}
                className={`${CARD} snap-start w-[150px] shrink-0 p-3 flex flex-col gap-2 hover:bg-gray-50 transition-colors`}>
                <CategoryTile id={l.category_id} size="sm" />
                <span className="text-[15px] leading-5 font-semibold text-gray-900 line-clamp-2 min-h-10">{l.title}</span>
                <span className="text-[13px] text-gray-500 truncate">{categoryLabel(l.category_id)} · {formatDate(l.created_at)}</span>
                <TypeBadge type={l.type} className="self-start" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>Prochainement</h2>
            <Link href="/evenements" className="text-[15px] text-brand-600 hover:text-brand-700">Agenda</Link>
          </div>
          {events.map(e => {
            const d = new Date(e.event_date)
            const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase()
            const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')
            return (
              <Link key={e.id} href={`/evenements/${e.id}`} className={`${CARD} flex items-center gap-3.5 p-3 hover:bg-gray-50 transition-colors`}>
                <span suppressHydrationWarning className="w-14 h-[60px] rounded-[13px] bg-brand-600 text-white flex flex-col items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold tracking-wider">{weekday}</span>
                  <span className="text-2xl leading-7 font-bold">{d.getDate()}</span>
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-base font-semibold text-gray-900 truncate">{e.title}</span>
                  <span suppressHydrationWarning className="text-[13px] text-gray-500 truncate">
                    {time}{e.location_text ? ` · ${e.location_text}` : ''}
                  </span>
                </span>
                <ChevronRight size={18} className="text-gray-400 shrink-0" />
              </Link>
            )
          })}
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className={SECTION_TITLE}>Vie du quartier</h2>
        {announcement && (
          <Link href="/infos" className={`${CARD} flex items-center gap-3 p-3.5 hover:bg-gray-50 transition-colors`}>
            <span className="w-10 h-10 rounded-[11px] bg-brand-600 text-white flex items-center justify-center shrink-0">
              <Megaphone size={20} />
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[13px] text-gray-500">Info de l&apos;ASL · {formatDate(announcement.created_at)}</span>
              <span className="text-base font-semibold text-gray-900 line-clamp-2">{announcement.title}</span>
            </span>
            <ChevronRight size={18} className="text-gray-400 shrink-0" />
          </Link>
        )}
        {poll && (
          <Link href="/infos" className={`${CARD} flex items-center gap-3 p-3.5 hover:bg-gray-50 transition-colors`}>
            <span className="w-10 h-10 rounded-[11px] bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <ChartColumn size={20} />
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span suppressHydrationWarning className="text-[13px] text-gray-500">
                Sondage{poll.closes_at ? ` · jusqu'au ${new Date(poll.closes_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}
              </span>
              <span className="text-base font-semibold text-gray-900 line-clamp-2">{poll.question}</span>
            </span>
            <ChevronRight size={18} className="text-gray-400 shrink-0" />
          </Link>
        )}
        {/* Raccourcis vers les autres rubriques du quartier : liste groupée façon iOS */}
        <div className={`${CARD} overflow-hidden`}>
          {[
            { href: '/achats', label: 'Achats groupés', icon: ShoppingCart },
            { href: '/prestataires', label: 'Prestataires recommandés', icon: Wrench },
            { href: '/documents', label: "Documents de l'ASL", icon: FileText },
          ].map((row, i) => (
            <Link key={row.href} href={row.href} className="flex items-center gap-3 pl-3.5 hover:bg-gray-50 transition-colors">
              <span className="w-[30px] h-[30px] rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <row.icon size={17} />
              </span>
              <span className={`flex-1 flex items-center justify-between py-3 pr-3.5 ${i > 0 ? 'border-t border-gray-200' : ''}`}>
                <span className="text-base text-gray-900">{row.label}</span>
                <ChevronRight size={18} className="text-gray-400" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
