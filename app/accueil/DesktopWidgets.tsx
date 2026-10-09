'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  CalendarDays, ChartColumn, ChevronRight, CircleCheck, ClipboardList, FileText, Handshake,
  Landmark, Megaphone, MessageCircle, ShoppingCart, Wrench, type LucideIcon,
} from 'lucide-react'
import { CategoryTile } from '@/components/listings/CategoryIcon'
import { TypeBadge } from '@/components/listings/TypeBadge'
import { documentViewerHref, heldOnDate } from '@/lib/documents'
import { cn, formatDate } from '@/lib/utils'
import type { DashboardData } from './DashboardClient'

/**
 * Accueil desktop (md+) : un tableau de widgets, façon iPadOS / macOS. Demandé le
 * 2026-10-09 : « fais tout en card widget », « sexy, sobre et beau ».
 *
 * Règles reprises du guide d'Apple « Adopting Liquid Glass » :
 * - le verre est réservé à la navigation (menu latéral) ; le contenu reste sur des
 *   cartes pleines, blanches, posées sur le fond gris système ;
 * - arrondis concentriques : carte de 24 px, marge de 16 px, donc 8 px pour ce
 *   qui est posé à l'intérieur (lignes survolées, pastilles) ;
 * - couleur rare : le vert pour l'étiquette du widget et les actions, la couleur
 *   d'un type d'annonce toujours accompagnée de sa lettre.
 *
 * Tailles de widgets d'Apple : petit (1 case), moyen (2 × 1), grand (2 × 2), sur
 * une grille à rangées fixes. Elle est toujours complète : un widget sans contenu
 * affiche un état calme au lieu de disparaître. En `lg`, 4 colonnes × 4 rangées
 * exactement ; en `md`, 2 colonnes.
 */

const WIDGET = 'relative flex flex-col min-w-0 overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_20px_rgba(0,0,0,0.05)]'
/** Un widget qui mène à une seule page est un lien entier */
const WIDGET_LINK = cn(
  WIDGET,
  'group transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_12px_32px_rgba(0,0,0,0.09)]',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
)
const BIG = 'text-[34px] leading-none font-bold tracking-tight text-gray-900'

const quantity = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Étiquette d'un widget : icône et nom en vert, chevron discret s'il mène quelque part. */
function Label({ icon: Icon, children, trailing, chevron = true }: {
  icon: LucideIcon
  children: ReactNode
  trailing?: ReactNode
  chevron?: boolean
}) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-600">
      <Icon size={15} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{children}</span>
      <span className="ml-auto flex items-center gap-1 shrink-0">
        {trailing}
        {chevron && <ChevronRight size={16} aria-hidden="true" className="text-gray-300 transition-colors group-hover:text-gray-500" />}
      </span>
    </span>
  )
}

/** État calme d'un widget sans contenu : il reste à sa place, la grille ne bouge pas. */
function Calm({ title, text, done }: { title: string; text: string; done?: boolean }) {
  return (
    <span className="mt-auto flex flex-col gap-1">
      {done && <CircleCheck size={24} aria-hidden="true" className="text-brand-600 mb-1" />}
      <span className="text-[17px] leading-[22px] font-semibold text-gray-900">{title}</span>
      <span className="text-[13px] leading-[18px] text-gray-500">{text}</span>
    </span>
  )
}

/** Avant la première réponse : pas d'état calme trompeur (« Rien de prévu »), un squelette. */
function Pending() {
  // Des <span> et non SkeletonBlock (un <div>) : on est dans un lien, en contenu de phrase.
  return (
    <span className="mt-auto flex flex-col gap-2" aria-hidden="true">
      <span className="block h-7 w-24 animate-pulse rounded-xl bg-surface-sunken" />
      <span className="block h-4 w-full animate-pulse rounded-xl bg-surface-sunken" />
    </span>
  )
}

/** Anneau de progression (achat groupé) : couleur par `currentColor`, couverte par le thème sombre. */
function Ring({ ratio }: { ratio: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100)
  return (
    <span className="relative w-14 h-14 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" stroke="currentColor" className="text-gray-200" />
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" stroke="currentColor" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} className="text-brand-600" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-gray-900">{pct} %</span>
    </span>
  )
}

/** « Dans 36 jours », « Demain », « Aujourd'hui » */
function countdown(date: Date): string {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - start.getTime()) / 86400000)
  if (days <= 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  return `Dans ${days} jours`
}

export function DesktopWidgets({ firstName, today, data, pendingRequestsCount, unreadCount }: {
  firstName: string | null
  today: string
  data: DashboardData | null
  pendingRequestsCount: number
  unreadCount: number
}) {
  const loading = data === null
  const [first, ...others] = data?.announcements ?? []
  const assembly = data?.assembly
  const assemblyDate = assembly ? heldOnDate(assembly.held_on) : null
  const event = data?.nextEvent
  const eventDate = event ? new Date(event.event_date) : null
  const poll = data?.poll
  const purchase = data?.purchase
  const documents = (data?.documents ?? []).slice(0, 3)
  const listings = data?.listings

  return (
    <div className="hidden md:block px-8 pt-8 pb-10">
      <div className="max-w-[1120px] mx-auto">
        <header className="mb-6 flex flex-col gap-0.5">
          {/* Date du navigateur : le serveur peut être sur un autre fuseau. */}
          <p suppressHydrationWarning className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">{today}</p>
          <h1 className="text-[34px] leading-10 font-bold tracking-tight text-gray-900">
            Bonjour{firstName ? ` ${firstName}` : ''}
          </h1>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[188px] gap-4">

          {/* Grand : l'ASL — la dernière information en entier, les deux précédentes en titre */}
          <Link href="/infos" className={cn(WIDGET_LINK, 'col-span-2 row-span-2')}>
            <Label icon={Megaphone} trailing={<span className="text-[13px] font-medium text-gray-400">Toutes les infos</span>}>
              L&apos;ASL du Cèdre
            </Label>
            {loading ? <Pending /> : first ? (
              <>
                <span className="mt-4 flex flex-col gap-2 min-h-0">
                  <span suppressHydrationWarning className="text-[13px] text-gray-500">
                    Information officielle · {formatDate(first.created_at).toLowerCase()}
                  </span>
                  <span className="text-2xl leading-[30px] font-semibold tracking-tight text-gray-900 line-clamp-2">{first.title}</span>
                  <span className="text-[15px] leading-[22px] text-gray-700 line-clamp-5 whitespace-pre-line">{first.body}</span>
                </span>
                {others.length > 0 && (
                  <span className="mt-auto pt-3 border-t border-gray-200 flex flex-col gap-1.5">
                    {others.map(a => (
                      <span key={a.id} className="flex items-baseline gap-3">
                        <span className="flex-1 min-w-0 text-[15px] font-medium text-gray-900 truncate">{a.title}</span>
                        <span suppressHydrationWarning className="text-[13px] text-gray-500 shrink-0">{formatDate(a.created_at)}</span>
                      </span>
                    ))}
                  </span>
                )}
              </>
            ) : (
              <Calm title="Aucune information récente" text="Les annonces du bureau de l'ASL apparaîtront ici." />
            )}
          </Link>

          {/* Moyen : la prochaine assemblée, avec son compte à rebours */}
          <Link href="/documents" className={cn(WIDGET_LINK, 'col-span-2')}>
            <Label icon={Landmark}>Assemblée générale</Label>
            {loading ? <Pending /> : assembly && assemblyDate ? (
              <span className="mt-auto flex items-end gap-5">
                <span suppressHydrationWarning className="flex flex-col leading-none">
                  <span className="text-[13px] font-semibold uppercase tracking-wide text-brand-600">
                    {assemblyDate.toLocaleDateString('fr-FR', { weekday: 'long' })}
                  </span>
                  <span className="text-[56px] leading-[52px] font-bold tracking-tight text-gray-900">{assemblyDate.getDate()}</span>
                  <span className="text-[15px] font-semibold text-gray-900">
                    {assemblyDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-1 pb-0.5">
                  <span className="text-[17px] leading-[22px] font-semibold text-gray-900 line-clamp-2">{assembly.title}</span>
                  <span suppressHydrationWarning className="text-[13px] text-gray-500">
                    {countdown(assemblyDate)} · {assembly.hasAgenda ? 'ordre du jour en ligne' : 'ordre du jour à venir'}
                  </span>
                </span>
              </span>
            ) : (
              <Calm title="Aucune assemblée prévue" text="Les procès-verbaux des précédentes sont dans les documents de l'ASL." />
            )}
          </Link>

          {/* Petit : le prochain événement */}
          <Link href={event ? `/evenements/${event.id}` : '/evenements'} className={WIDGET_LINK}>
            <Label icon={CalendarDays}>Agenda</Label>
            {loading ? <Pending /> : event && eventDate ? (
              <span className="mt-auto flex flex-col gap-1 min-w-0">
                <span suppressHydrationWarning className="text-[28px] leading-8 font-bold tracking-tight text-gray-900">
                  {capitalize(eventDate.toLocaleDateString('fr-FR', { weekday: 'short' }))} {eventDate.getDate()}
                </span>
                <span className="text-[15px] leading-5 font-semibold text-gray-900 line-clamp-2">{event.title}</span>
                <span suppressHydrationWarning className="text-[13px] text-gray-500 truncate">
                  {eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}
                  {event.location_text ? ` · ${event.location_text}` : ''}
                </span>
              </span>
            ) : (
              <Calm title="Rien de prévu" text="Aucun événement à venir." />
            )}
          </Link>

          {/* Petit : le sondage qui attend un vote */}
          <Link href="/infos" className={WIDGET_LINK}>
            <Label icon={ChartColumn}>Sondage</Label>
            {loading ? <Pending /> : poll ? (
              <span className="mt-auto flex flex-col gap-2 min-w-0">
                <span className="text-base leading-[21px] font-semibold text-gray-900 line-clamp-3">{poll.question}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-xs font-semibold shrink-0">À voter</span>
                  {poll.closes_at && (
                    <span suppressHydrationWarning className="text-[13px] text-gray-500 truncate">
                      avant le {new Date(poll.closes_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </span>
              </span>
            ) : (
              <Calm done title="Vous êtes à jour" text="Aucun sondage à voter." />
            )}
          </Link>

          {/* Moyen : les documents de l'ASL, chacun ouvert dans la visionneuse */}
          <div className={cn(WIDGET, 'col-span-2')}>
            <Link href="/documents" className="group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Label icon={FileText}>Documents de l&apos;ASL</Label>
            </Link>
            {loading ? <Pending /> : documents.length > 0 ? (
              <span className="mt-auto flex flex-col">
                {documents.map(doc => (
                  <Link key={doc.id} href={documentViewerHref(doc.id)}
                    className="group -mx-2 px-2 py-1.5 rounded-lg flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                      <FileText size={16} aria-hidden="true" />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[15px] leading-5 font-semibold text-gray-900 truncate">{doc.title}</span>
                      <span suppressHydrationWarning className="text-xs text-gray-500 truncate">{doc.subtitle}</span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" className="text-gray-300 group-hover:text-gray-500 shrink-0" />
                  </Link>
                ))}
              </span>
            ) : (
              <Calm title="Aucun document publié" text="Les statuts et les procès-verbaux apparaîtront ici." />
            )}
          </div>

          {/* Petit : l'achat groupé en cours, avec sa progression */}
          <Link href="/achats" className={WIDGET_LINK}>
            <Label icon={ShoppingCart}>Achat groupé</Label>
            {loading ? <Pending /> : purchase ? (
              <span className="mt-auto flex items-end justify-between gap-2 min-w-0">
                <span className="min-w-0 flex flex-col gap-0.5">
                  {!purchase.target && <span className={BIG}>{quantity(purchase.total)}</span>}
                  <span className="text-[15px] leading-5 font-semibold text-gray-900 line-clamp-2">{purchase.title}</span>
                  <span className="text-[13px] text-gray-500 truncate">
                    {purchase.target
                      ? `${quantity(purchase.total)} / ${quantity(purchase.target)} ${purchase.unit}`
                      : purchase.unit}
                  </span>
                </span>
                {purchase.target ? <Ring ratio={purchase.total / purchase.target} /> : null}
              </span>
            ) : (
              <Calm title="Pas d'achat en cours" text="Les commandes à plusieurs apparaîtront ici." />
            )}
          </Link>

          {/* Petit : les demandes en cours */}
          <Link href="/demandes" className={WIDGET_LINK}>
            <Label icon={ClipboardList}>Demandes</Label>
            {loading ? <Pending /> : pendingRequestsCount > 0 ? (
              <span className="mt-auto flex flex-col gap-1.5">
                <span className={BIG}>{pendingRequestsCount}</span>
                <span className="text-[13px] text-gray-500">
                  {pendingRequestsCount > 1 ? 'demandes en cours' : 'demande en cours'} · prêts, dons, services
                </span>
              </span>
            ) : (
              <Calm done title="Tout est à jour" text="Aucune demande en cours." />
            )}
          </Link>

          {/* Moyen : les dernières annonces entre voisins */}
          <div className={cn(WIDGET, 'col-span-2')}>
            <Link href="/map" className="group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Label icon={Handshake} trailing={listings && listings.count > 0 && (
                <span className="text-[13px] font-medium text-gray-400">
                  {listings.count} annonce{listings.count > 1 ? 's' : ''}
                </span>
              )}>
                Entre voisins
              </Label>
            </Link>
            {loading ? <Pending /> : listings && listings.latest.length > 0 ? (
              <span className="mt-auto flex flex-col">
                {listings.latest.map(l => (
                  <Link key={l.id} href={`/listings/${l.id}`}
                    className="-mx-2 px-2 py-1 rounded-lg flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <CategoryTile id={l.category_id} type={l.type} size="sm" />
                    <span className="flex-1 min-w-0 text-[15px] font-semibold text-gray-900 truncate">{l.title}</span>
                    <TypeBadge type={l.type} className="shrink-0" />
                  </Link>
                ))}
              </span>
            ) : (
              <Calm title="Aucune annonce pour l'instant" text="Les prêts, dons et services du quartier apparaîtront ici." />
            )}
          </div>

          {/* Petit : les messages non lus */}
          <Link href="/messages" className={WIDGET_LINK}>
            <Label icon={MessageCircle}>Messages</Label>
            {loading ? <Pending /> : unreadCount > 0 ? (
              <span className="mt-auto flex flex-col gap-1.5">
                <span className={BIG}>{unreadCount}</span>
                <span className="text-[13px] text-gray-500">{unreadCount > 1 ? 'messages non lus' : 'message non lu'}</span>
              </span>
            ) : (
              <Calm done title="Tout est lu" text="Aucun message en attente." />
            )}
          </Link>

          {/* Petit : le carnet des prestataires */}
          <Link href="/prestataires" className={WIDGET_LINK}>
            <Label icon={Wrench}>Prestataires</Label>
            {loading ? <Pending /> : (data?.providersCount ?? 0) > 0 ? (
              <span className="mt-auto flex flex-col gap-1.5">
                <span className={BIG}>{data!.providersCount}</span>
                <span className="text-[13px] text-gray-500">
                  artisan{data!.providersCount > 1 ? 's' : ''} recommandé{data!.providersCount > 1 ? 's' : ''} par les voisins
                </span>
              </span>
            ) : (
              <Calm title="Aucun pour l'instant" text="Recommandez un artisan aux voisins." />
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
