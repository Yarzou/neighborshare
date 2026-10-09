'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChartColumn, ChevronRight, ClipboardList, FileText, Megaphone, ShoppingCart, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePendingRequests, useUnreadCount } from '@/lib/hooks'
import { readPageCache, writePageCache } from '@/lib/pageCache'
import { documentViewerHref, formatHeldOn, heldOnDate, todayIso } from '@/lib/documents'
import { cn, formatDate } from '@/lib/utils'
import { ASL_DOCUMENT_KIND_LABELS, type AslDocumentKind, type ListingType } from '@/lib/types'
import { DesktopWidgets } from './DesktopWidgets'

interface Props {
  firstName: string | null
}

export interface AnnouncementRow { id: string; title: string; body: string; created_at: string }
interface AssemblyRow { id: string; title: string; held_on: string; assembly_documents: { id: string; kind: string }[] | null }
interface AslDocRow { id: string; kind: AslDocumentKind; title: string | null; page_count: number | null }
interface PollRow { id: string; question: string; closes_at: string | null }
interface PurchaseRow { id: string; title: string; unit: string; target_quantity: number | null; group_purchase_participants: { quantity: number }[] | null }
export interface EventRow { id: string; title: string; event_date: string; location_text: string | null }
export interface ListingRow { id: string; title: string; type: ListingType; category_id: number | null }

export interface DashboardData {
  /** Les trois dernières informations de l'ASL (épinglées d'abord) */
  announcements: AnnouncementRow[]
  /** Prochaine assemblée (date à venir, PV pas encore publié) */
  assembly: { title: string; held_on: string; hasAgenda: boolean } | null
  /** Sondage ouvert auquel on n'a pas encore répondu */
  poll: PollRow | null
  purchase: { title: string; unit: string; total: number; target: number | null } | null
  nextEvent: EventRow | null
  documents: { id: string; title: string; subtitle: string }[]
  /** Annonces disponibles entre voisins (widgets desktop) */
  listings: { count: number; latest: ListingRow[] }
  /** Prestataires recommandés (widgets desktop) */
  providersCount: number
}

/**
 * Clé du cache de page (`lib/pageCache.ts`) : au retour sur l'onglet, les blocs
 * s'affichent tout de suite. Suffixée à chaque changement de forme des données.
 */
const CACHE_KEY = 'accueil:v2'

/** Ordre d'affichage des documents permanents de l'ASL */
const ASL_KIND_ORDER: AslDocumentKind[] = ['statuts', 'reglement', 'autre']

/** Carte blanche sur fond gris, ombre à peine visible (maquette « Verre et Cèdre »). */
const CARD = 'bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
const SECTION_TITLE = 'text-xl font-bold tracking-tight text-gray-900'

const quantity = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

/** Pastille d'icône d'une ligne : verte pleine pour l'ASL et ce qui attend une action, grise sinon. */
function IconTile({ icon: Icon, filled }: { icon: LucideIcon; filled?: boolean }) {
  return (
    <span className={cn(
      'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0',
      filled ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-600',
    )}>
      <Icon size={19} />
    </span>
  )
}

/** Pastille de date (jour de la semaine + quantième), pour une assemblée ou un événement. */
function DateTile({ date, filled }: { date: Date; filled?: boolean }) {
  return (
    <span suppressHydrationWarning className={cn(
      'w-9 h-10 rounded-[10px] flex flex-col items-center justify-center leading-none shrink-0',
      filled ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-600',
    )}>
      <span className="text-[9.5px] font-bold tracking-wider">{date.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase()}</span>
      <span className="text-[17px] font-bold">{date.getDate()}</span>
    </span>
  )
}

interface Row { key: string; href: string; tile: ReactNode; title: string; subtitle: string; extra?: ReactNode }

/** Liste groupée façon iOS : séparateur décalé sous le texte, pas sous l'icône. */
function GroupedList({ rows }: { rows: Row[] }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      {rows.map((row, i) => (
        <Link key={row.key} href={row.href} className="flex items-center gap-3 pl-3 hover:bg-gray-50 transition-colors">
          {row.tile}
          <span className={cn('flex-1 min-w-0 flex items-center gap-2 py-3 pr-3.5', i > 0 && 'border-t border-gray-200')}>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-base font-semibold text-gray-900 truncate">{row.title}</span>
              <span suppressHydrationWarning className="text-[13px] text-gray-500 truncate">{row.subtitle}</span>
              {row.extra}
            </span>
            <ChevronRight size={18} className="text-gray-400 shrink-0" />
          </span>
        </Link>
      ))}
    </div>
  )
}

/**
 * Accueil connecté. L'appli est d'abord celle de l'ASL du Cèdre (80 maisons,
 * espaces communs en copropriété).
 *
 * - **Mobile** : « Résumé ASL » validé sur maquette le 2026-10-09, court pour ne
 *   pas avoir à défiler. Dernière information de l'ASL ; « À suivre », avec des
 *   lignes qui n'apparaissent que si elles servent (assemblée, sondage pas encore
 *   voté, achat groupé, événement, demandes) ; documents de l'ASL.
 * - **Desktop** (md+) : tableau de widgets (`DesktopWidgets`), demandé le
 *   2026-10-09 (« fais tout en card widget »). La grille est fixe : un widget
 *   sans contenu affiche un état calme au lieu de disparaître.
 *
 * Tout est lu côté client, en une salve de requêtes parallèles ; un bloc dont la
 * table manque encore sur la base reste vide, sans erreur (comme /infos).
 */
export default function DashboardClient({ firstName }: Props) {
  const pendingRequestsCount = usePendingRequests()
  const unreadCount = useUnreadCount()
  // Dernières données connues : affichées d'emblée au retour sur l'onglet, puis
  // remplacées par celles des requêtes ci-dessous.
  const [data, setData] = useState<DashboardData | null>(() => readPageCache<DashboardData>(CACHE_KEY) ?? null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const now = new Date().toISOString()
    const today = todayIso()

    // La vue `listings_geo` exclut les annonces expirées ; la table sert de repli
    // tant que la migration 032 manque sur une base.
    const loadListings = async () => {
      const columns = 'id, title, type, category_id'
      const fromView = await supabase.from('listings_geo').select(columns, { count: 'exact' })
        .eq('status', 'disponible').order('created_at', { ascending: false }).limit(3)
      if (!fromView.error) return fromView
      return supabase.from('listings').select(columns, { count: 'exact' })
        .eq('status', 'disponible').order('created_at', { ascending: false }).limit(3)
    }

    Promise.all([
      supabase.from('announcements').select('id, title, body, created_at')
        .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
      // Les assemblées récentes donnent à la fois la prochaine et le dernier PV
      supabase.from('assemblies').select('id, title, held_on, assembly_documents(id, kind)')
        .order('held_on', { ascending: false }).limit(20),
      supabase.from('asl_documents').select('id, kind, title, page_count'),
      supabase.from('polls').select('id, question, closes_at')
        .or(`closes_at.is.null,closes_at.gt.${now}`).order('created_at', { ascending: false }).limit(10),
      // RLS : chacun ne lit que ses propres votes
      supabase.from('poll_votes').select('poll_id'),
      supabase.from('group_purchases').select('id, title, unit, target_quantity, group_purchase_participants(quantity)')
        .eq('status', 'ouvert').or(`deadline.is.null,deadline.gte.${today}`)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('events').select('id, title, event_date, location_text')
        .gte('event_date', now).order('event_date').limit(1),
      loadListings(),
      supabase.from('providers').select('id', { count: 'exact', head: true }),
    ]).then(([annRes, asmRes, aslRes, pollRes, voteRes, gpRes, eventRes, listingRes, providerRes]) => {
      if (cancelled) return

      const assemblies = (asmRes.data as AssemblyRow[] | null) ?? []
      const hasKind = (a: AssemblyRow, kind: string) => (a.assembly_documents ?? []).some(d => d.kind === kind)
      // Triées de la plus récente à la plus ancienne : la prochaine est la dernière à venir
      const upcoming = assemblies.filter(a => a.held_on >= today && !hasKind(a, 'minutes')).at(-1)
      const withMinutes = assemblies.find(a => hasKind(a, 'minutes'))
      const minutes = withMinutes?.assembly_documents?.find(d => d.kind === 'minutes')

      const voted = new Set(((voteRes.data as { poll_id: string }[] | null) ?? []).map(v => v.poll_id))
      const purchase = ((gpRes.data as PurchaseRow[] | null) ?? [])[0]

      const aslDocs = ((aslRes.data as AslDocRow[] | null) ?? [])
        .sort((a, b) => ASL_KIND_ORDER.indexOf(a.kind) - ASL_KIND_ORDER.indexOf(b.kind))

      const next: DashboardData = {
        announcements: (annRes.data as AnnouncementRow[] | null) ?? [],
        assembly: upcoming ? { title: upcoming.title, held_on: upcoming.held_on, hasAgenda: hasKind(upcoming, 'agenda') } : null,
        poll: ((pollRes.data as PollRow[] | null) ?? []).find(p => !voted.has(p.id)) ?? null,
        purchase: purchase ? {
          title: purchase.title,
          unit: purchase.unit,
          total: (purchase.group_purchase_participants ?? []).reduce((sum, p) => sum + Number(p.quantity), 0),
          target: purchase.target_quantity,
        } : null,
        nextEvent: ((eventRes.data as EventRow[] | null) ?? [])[0] ?? null,
        documents: [
          ...aslDocs.map(d => ({
            id: d.id,
            title: d.title || ASL_DOCUMENT_KIND_LABELS[d.kind],
            subtitle: d.page_count ? `PDF · ${d.page_count} pages` : 'PDF',
          })),
          ...(withMinutes && minutes ? [{
            id: minutes.id,
            title: 'Dernier procès-verbal',
            subtitle: `${withMinutes.title} · ${formatHeldOn(withMinutes.held_on)}`,
          }] : []),
        ],
        listings: {
          count: listingRes.count ?? 0,
          latest: (listingRes.data as ListingRow[] | null) ?? [],
        },
        providersCount: providerRes.count ?? 0,
      }
      writePageCache(CACHE_KEY, next)
      setData(next)
    })
    return () => { cancelled = true }
  }, [])

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // « À suivre » (mobile) : seulement ce qui existe et attend quelque chose de nous.
  const rows: Row[] = []
  if (data?.assembly) {
    rows.push({
      key: 'assemblee',
      href: '/documents',
      tile: <DateTile date={heldOnDate(data.assembly.held_on)} filled />,
      title: data.assembly.title,
      subtitle: formatHeldOn(data.assembly.held_on) + (data.assembly.hasAgenda ? ' · ordre du jour en ligne' : ''),
    })
  }
  if (data?.poll) {
    rows.push({
      key: 'sondage',
      href: '/infos',
      tile: <IconTile icon={ChartColumn} />,
      title: data.poll.question,
      subtitle: 'Sondage · à voter'
        + (data.poll.closes_at ? ` avant le ${new Date(data.poll.closes_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''),
    })
  }
  if (data?.purchase) {
    const { title, unit, total, target } = data.purchase
    rows.push({
      key: 'achat',
      href: '/achats',
      tile: <IconTile icon={ShoppingCart} />,
      title,
      subtitle: `Achat groupé · ${quantity(total)} ${unit}${target ? ` sur ${quantity(target)}` : ''}`,
      extra: target ? (
        <span className="mt-1.5 h-1 rounded-full bg-brand-100 overflow-hidden" aria-hidden="true">
          <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, (total / target) * 100)}%` }} />
        </span>
      ) : undefined,
    })
  }
  if (data?.nextEvent) {
    const date = new Date(data.nextEvent.event_date)
    rows.push({
      key: 'evenement',
      href: `/evenements/${data.nextEvent.id}`,
      tile: <DateTile date={date} />,
      title: data.nextEvent.title,
      subtitle: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')
        + (data.nextEvent.location_text ? ` · ${data.nextEvent.location_text}` : ''),
    })
  }
  if (pendingRequestsCount > 0) {
    rows.push({
      key: 'demandes',
      href: '/demandes',
      tile: <IconTile icon={ClipboardList} filled />,
      title: `${pendingRequestsCount} demande${pendingRequestsCount > 1 ? 's' : ''} en cours`,
      subtitle: 'Prêts, dons et services à suivre',
    })
  }

  const documents: Row[] = (data?.documents ?? []).map(doc => ({
    key: doc.id,
    href: documentViewerHref(doc.id),
    tile: <IconTile icon={FileText} />,
    title: doc.title,
    subtitle: doc.subtitle,
  }))

  const announcement = data?.announcements[0]

  return (
    <>
      {/* ── Mobile : Résumé ASL, une colonne ── */}
      <div className="md:hidden max-w-2xl mx-auto px-4 pt-6 pb-6 flex flex-col gap-6">
        {/* Pas de « + » ici (retiré à la demande, 2026-10-07) : on publie depuis la Carte. */}
        <header className="flex flex-col gap-0.5">
          {/* Date du navigateur : le serveur peut être sur un autre fuseau. */}
          <p suppressHydrationWarning className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">{today}</p>
          <h1 className="text-[34px] leading-10 font-bold tracking-tight text-gray-900">
            Bonjour{firstName ? ` ${firstName}` : ''}
          </h1>
        </header>

        {announcement && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className={SECTION_TITLE}>L&apos;ASL du Cèdre</h2>
              <Link href="/infos" className="text-[15px] text-brand-600 hover:text-brand-700">Toutes les infos</Link>
            </div>
            <Link href="/infos" className={`${CARD} flex gap-3 p-4 hover:bg-gray-50 transition-colors`}>
              <IconTile icon={Megaphone} filled />
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span suppressHydrationWarning className="text-[13px] text-gray-500">
                  Information officielle · {formatDate(announcement.created_at).toLowerCase()}
                </span>
                <span className="text-[17px] leading-[22px] font-semibold text-gray-900">{announcement.title}</span>
                {/* Deux lignes au plus : la page doit tenir sans défiler */}
                <span className="text-[15px] leading-5 text-gray-700 line-clamp-2">{announcement.body}</span>
              </span>
            </Link>
          </section>
        )}

        {rows.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className={SECTION_TITLE}>À suivre</h2>
            <GroupedList rows={rows} />
          </section>
        )}

        {documents.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className={SECTION_TITLE}>Documents de l&apos;ASL</h2>
              <Link href="/documents" className="text-[15px] text-brand-600 hover:text-brand-700">Tout voir</Link>
            </div>
            <GroupedList rows={documents} />
          </section>
        )}
      </div>

      {/* ── Desktop : tableau de widgets ── */}
      <DesktopWidgets
        firstName={firstName}
        today={today}
        data={data}
        pendingRequestsCount={pendingRequestsCount}
        unreadCount={unreadCount}
      />
    </>
  )
}
