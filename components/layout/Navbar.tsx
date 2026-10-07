'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { MapPin, MessageCircle, LogOut, ClipboardList, CalendarDays, House, TreePine } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, getAvatarStyle, getInitials } from '@/lib/utils'
import { useUnreadCount, usePendingRequests } from '@/lib/hooks'
import { useTheme } from '@/components/theme/ThemeProvider'
import type { User as SupabaseUser } from '@supabase/supabase-js'

/** Le strict nécessaire pour la pastille d'avatar. */
interface NavProfile {
  full_name: string | null
  username: string | null
  avatar_color: string | null
}

/** Initiales de la pastille : nom complet, sinon pseudo, sinon email. */
function initialsOf(p: NavProfile | null, fallback: string | undefined): string {
  return getInitials(p?.full_name?.trim() || p?.username?.trim() || fallback)
}

/**
 * Écrans « poussés », sans barre d'onglets (comme sur iOS) : ils ont leur propre
 * barre d'action en bas (envoi d'un message, bouton Contacter, formulaire), que
 * la barre d'onglets recouvrirait. La page d'accueil publique n'en a pas non plus.
 */
const NO_TABBAR = [
  /^\/$/,
  /^\/messages\/.+/,
  /^\/listings\/.+/,
  /^\/evenements\/(new|[^/]+\/edit)$/,
  /^\/documents\/[^/]+$/,
]

interface NavItem {
  href: string
  label: string
  icon: typeof House
  /** Préfixes qui rendent l'entrée active (défaut : `href`) */
  matches?: string[]
  count?: number
}

/** Marge intérieure de la barre (p-1), en px : la bulle ne la franchit pas. */
const TAB_INSET = 4
/**
 * Marge de la bulle autour de l'icône et du libellé, de chaque côté. 14 px dans
 * Fridge, qui n'a que trois onglets ; avec cinq, au-delà de 10 px la bulle de
 * « Messages » mordrait sur les libellés voisins.
 */
const TAB_PAD_X = 10

interface Slot {
  /** Bord gauche du contenu (icône + libellé), depuis le bord de la barre */
  left: number
  width: number
}

/** Mise en page de l'intérieur d'un onglet : la même pour la rangée réelle et pour la loupe. */
const TAB_CONTENT = 'relative flex flex-col items-center gap-0.5 text-[10.5px] leading-[13px] font-semibold'
/** Épaisseur du liseré de la barre : les éléments en `absolute` partent de l'intérieur. */
const TAB_BORDER = 1
/** Hauteur intérieure de la barre (62 px moins les deux liserés). */
const TAB_INNER_H = 60
/** Grossissement de la loupe. */
const LENS_ZOOM = 1.28
/** La loupe déborde un peu de la barre, en haut et en bas, comme sur iOS. */
const LENS_POP = 5
/** Appui tenu (ms) avant que la loupe n'apparaisse : un simple toucher ne la montre pas. */
const LENS_DELAY = 160

/**
 * Barre d'onglets mobile, partie de la barre de l'app Fridge, façon « Liquid
 * Glass » d'iOS. Plus de bouton « + » à côté (2026-10-07) : il créait une annonce
 * même depuis le Quartier. Chaque page a son « + ».
 *
 * - **Verre** : semi-transparente au repos, peu floutée, pour deviner le contenu
 *   qui défile dessous ; elle se densifie dès que le doigt se pose dessus.
 * - **Bulle** : gris système translucide, taillée autour de l'icône et du libellé
 *   de l'onglet choisi (mesurés par un ResizeObserver). Au toucher, elle part tout
 *   de suite vers l'onglet, sans attendre la page, en s'étirant comme une goutte.
 * - **Loupe** (2026-10-07) : doigt appuyé ou glissé, la bulle devient une lentille
 *   de verre qui grossit réellement les onglets situés dessous (une copie agrandie
 *   de la rangée, calée sous la lentille). Elle suit le doigt ; au lâcher, l'onglet
 *   le plus proche s'ouvre.
 * Avec « Réduire les animations », tout se déplace sans effet.
 */
function TabBar({ items, activeIndex, badge }: {
  items: NavItem[]
  activeIndex: number
  badge: (n: number | undefined, className?: string) => React.ReactNode
}) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const barRef = useRef<HTMLDivElement>(null)
  const contentRefs = useRef<(HTMLSpanElement | null)[]>([])
  const gesture = useRef<{ startX: number; dragging: boolean } | null>(null)
  const swallowClick = useRef(false)
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Onglet visé au toucher, valable tant que l'URL n'a pas changé
  const [pending, setPending] = useState<{ index: number; from: string } | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  // Doigt posé sur la barre (elle se densifie), et abscisse de l'appui
  const [pressX, setPressX] = useState<number | null>(null)
  // Loupe visible : appui tenu, ou glissé
  const [lifted, setLifted] = useState(false)
  // La goutte ne se déforme qu'après un premier geste, pas à l'ouverture de l'appli
  const [touched, setTouched] = useState(false)
  const [bar, setBar] = useState<{ width: number; slots: Slot[] } | null>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect()
      setBar({
        width: box.width,
        slots: contentRefs.current.map(content => {
          const r = content?.getBoundingClientRect()
          return r ? { left: r.left - box.left, width: r.width } : { left: 0, width: 0 }
        }),
      })
    })
    observer.observe(el)
    // Les libellés s'élargissent à l'arrivée de la police : la bulle suit.
    contentRefs.current.forEach(content => content && observer.observe(content))
    return () => {
      observer.disconnect()
      if (liftTimer.current) clearTimeout(liftTimer.current)
    }
  }, [])

  const count = items.length
  const index = pending && pending.from === pathname ? pending.index : activeIndex

  /** Onglet sous un point de la barre (abscisse depuis son bord gauche, largeur de la barre). */
  const tabAt = (x: number, width: number) =>
    Math.min(count - 1, Math.max(0, Math.floor(((x - TAB_INSET) / (width - TAB_INSET * 2)) * count)))
  const localX = (clientX: number) => clientX - barRef.current!.getBoundingClientRect().left

  /** La bulle part tout de suite vers l'onglet, sans attendre la page. */
  const mark = (next: number) => {
    setTouched(true)
    setPending({ index: next, from: pathname })
  }

  /** Fin du geste : la barre redevient transparente, la loupe disparaît. */
  const release = () => {
    if (liftTimer.current) clearTimeout(liftTimer.current)
    liftTimer.current = null
    setPressX(null)
    setLifted(false)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { startX: e.clientX, dragging: false }
    swallowClick.current = false
    setPressX(localX(e.clientX))
    liftTimer.current = setTimeout(() => setLifted(true), LENS_DELAY)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging) {
      if (Math.abs(e.clientX - g.startX) < 8) return
      g.dragging = true
      setTouched(true)
      setLifted(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDrag(localX(e.clientX))
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    release()
    if (!g?.dragging) return
    swallowClick.current = true
    setDrag(null)
    const next = tabAt(localX(e.clientX), barRef.current!.getBoundingClientRect().width)
    mark(next)
    if (next !== activeIndex) router.push(items[next].href)
  }

  // Bulle au repos : autour du contenu de l'onglet choisi, sans sortir de la barre.
  let bubble: { left: number; width: number } | null = null
  if (bar && index >= 0) {
    const slot = bar.slots[index]
    const width = Math.min(slot.width + TAB_PAD_X * 2, bar.width - TAB_INSET * 2)
    const center = slot.left + slot.width / 2
    const left = Math.min(Math.max(center - width / 2, TAB_INSET), bar.width - TAB_INSET - width)
    bubble = { left, width }
  }

  // Loupe : centrée sous le doigt (glissé ou appui), à la largeur de l'onglet
  // survolé, un peu plus grande que la bulle.
  const pointer = drag ?? pressX
  let lens: { left: number; width: number; center: number; hovered: number } | null = null
  if (bar && pointer !== null) {
    const hovered = tabAt(pointer, bar.width)
    const slot = bar.slots[hovered]
    const width = Math.min((slot.width + TAB_PAD_X * 2) * 1.14, bar.width - 4)
    const center = drag !== null ? drag : slot.left + slot.width / 2
    const left = Math.min(Math.max(center - width / 2, 2), bar.width - 2 - width)
    lens = { left, width, center: left + width / 2, hovered }
  }

  /** Intérieur d'un onglet (icône, pastille, libellé) : la rangée réelle et sa copie agrandie. */
  const tabInner = (item: NavItem) => {
    const Icon = item.icon
    return (
      <>
        <span className="relative flex">
          <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
          {/* Pastille sur le coin de l'icône : hors mesure de la bulle */}
          {badge(item.count, 'absolute -top-1.5 -right-3')}
        </span>
        {item.label}
      </>
    )
  }

  const touching = pressX !== null || drag !== null

  return (
    <div
      id="app-tabbar"
      className="md:hidden fixed z-[1200] left-4 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <nav aria-label="Navigation principale">
        <div
          ref={barRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={() => {
            // Souris sortie sans glisser : on relâche
            if (!gesture.current?.dragging) { gesture.current = null; release() }
          }}
          onClickCapture={e => {
            // Fin d'un glissé : la navigation est déjà partie, pas de second clic.
            // Le clic du clavier (detail 0) n'est jamais celui d'un glissé.
            if (swallowClick.current && e.detail !== 0) {
              e.preventDefault()
              e.stopPropagation()
              swallowClick.current = false
            }
          }}
          className={cn(
            'relative grid grid-cols-5 h-[62px] p-1 touch-none select-none [-webkit-touch-callout:none] rounded-full border border-tabbar-edge shadow-tabbar',
            'backdrop-saturate-[1.8] transition-[background-color,backdrop-filter] duration-200',
            // Au repos : on devine le contenu qui défile dessous ; doigt posé : la barre se densifie
            touching ? 'bg-tabbar-strong backdrop-blur-xl' : 'bg-tabbar backdrop-blur-[6px]',
          )}
        >
          {bubble && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-1 left-0 transition-[transform,width] duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(${bubble.left - TAB_BORDER}px)`, width: bubble.width }}
            >
              <span
                key={touched ? index : 'repos'}
                className={cn(
                  'block h-full w-full rounded-full bg-bubble shadow-bubble transition-opacity duration-150',
                  touched && 'motion-safe:animate-bubble',
                  // Pendant la loupe, la bulle s'efface : c'est la loupe qui marque l'onglet
                  lifted && 'opacity-0',
                )}
              />
            </span>
          )}

          {items.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              draggable={false}
              onClick={() => mark(i)}
              aria-current={i === activeIndex ? 'page' : undefined}
              className={cn(
                'relative z-10 flex items-center justify-center rounded-full transition-colors duration-300',
                i === index ? 'text-brand-700' : 'text-gray-500',
              )}
            >
              <span
                ref={el => {
                  contentRefs.current[i] = el
                }}
                className={TAB_CONTENT}
              >
                {tabInner(item)}
              </span>
            </Link>
          ))}

          {/* Loupe : lentille de verre posée sur les onglets, qui contient une copie
              agrandie de la rangée, calée pour que son centre coïncide avec celui
              de la lentille. Au-dessus des onglets réels, qu'elle masque. */}
          {lens && (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute z-20 rounded-full overflow-hidden bg-lens-fill shadow-lens',
                'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                lifted ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
              )}
              style={{
                left: lens.left - TAB_BORDER,
                width: lens.width,
                top: -LENS_POP,
                height: TAB_INNER_H + LENS_POP * 2,
              }}
            >
              <span
                className="absolute grid grid-cols-5 p-1"
                style={{
                  left: -(lens.left - TAB_BORDER),
                  top: LENS_POP,
                  width: bar!.width - TAB_BORDER * 2,
                  height: TAB_INNER_H,
                  transform: `scale(${LENS_ZOOM})`,
                  transformOrigin: `${lens.center - TAB_BORDER}px ${TAB_INNER_H / 2}px`,
                }}
              >
                {items.map((item, i) => (
                  <span
                    key={item.label}
                    className={cn('flex items-center justify-center', i === lens!.hovered ? 'text-brand-700' : 'text-gray-500')}
                  >
                    <span className={TAB_CONTENT}>{tabInner(item)}</span>
                  </span>
                ))}
              </span>
            </span>
          )}
        </div>
      </nav>
    </div>
  )
}

/**
 * Navigation, refonte « Verre et Cèdre » (2026-10-06, maquette validée).
 *
 * Mobile : une barre du haut en verre (logo, Demandes, avatar) et une barre
 * d'onglets flottante en bas — Accueil, Carte, Agenda, Messages, Quartier. Pas de
 * bouton « Publier » global : chaque page porte son « + » en haut à droite. La
 * barre d'onglets se masque sur les écrans poussés (`NO_TABBAR`).
 * Desktop : un menu latéral flottant, rail d'icônes en md (la place manque à
 * 768 px, à côté des volets de 320 px) et libellés à partir de lg.
 *
 * Les trois éléments portent un `id` : globals.css en déduit, via `:has()`, les
 * marges de la page et la hauteur utile `--app-h`. Rien à recalculer en JS.
 */
export function Navbar() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { setTheme } = useTheme()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<NavProfile | null>(null)
  // Compteurs factorisés dans lib/hooks.ts : un seul magasin et un seul abonnement
  // Realtime par compteur, quel que soit le nombre de pastilles affichées.
  const unreadCount = useUnreadCount()
  const pendingRequestsCount = usePendingRequests()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Pastille d'avatar : une lecture légère, rejouée si le compte change.
  useEffect(() => {
    // Pas de remise à null synchrone (règle set-state-in-effect) : déconnecté, la
    // pastille n'est pas rendue, et une nouvelle session remplace le profil.
    if (!user) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('full_name, username, avatar_color')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setProfile((data as NavProfile | null) ?? null) })
    return () => { cancelled = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    setTheme('system')
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  /** Les pages personnelles passent par la connexion quand on n'a pas de compte. */
  const guarded = (href: string) => (user ? href : `/auth/login?redirect=${encodeURIComponent(href)}`)

  const homeHref = user ? '/accueil' : '/'
  const items: NavItem[] = [
    { href: homeHref, label: 'Accueil', icon: House, matches: ['/accueil'] },
    { href: '/map', label: 'Carte', icon: MapPin },
    { href: '/evenements', label: 'Agenda', icon: CalendarDays },
    { href: guarded('/messages'), label: 'Messages', icon: MessageCircle, matches: ['/messages'], count: unreadCount },
    // Section « Quartier » = 4 pages sous onglets : l'entrée reste active sur chacune.
    { href: '/infos', label: 'Quartier', icon: TreePine, matches: ['/infos', '/achats', '/prestataires', '/documents'] },
  ]
  const demandes: NavItem = {
    href: guarded('/demandes'), label: 'Demandes', icon: ClipboardList, matches: ['/demandes'], count: pendingRequestsCount,
  }
  const sidebarItems = [...items.slice(0, 4), demandes, items[4]]

  const isActive = (item: NavItem) => (item.matches ?? [item.href]).some(p => pathname.startsWith(p))
  const initials = initialsOf(profile, user?.email ?? undefined)
  const displayName = profile?.full_name || profile?.username || 'Mon profil'

  // Pastille de compteur : verte, détourée de blanc pour se détacher de l'icône.
  const badge = (n: number | undefined, className?: string) => (n ?? 0) > 0 && (
    <span className={cn(
      'min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold leading-none',
      'flex items-center justify-center ring-2 ring-surface',
      className,
    )}>
      {n! > 9 ? '9+' : n}
    </span>
  )

  const avatar = (size: string) => (
    <span
      className={cn('rounded-full flex items-center justify-center font-bold shrink-0', size, initials.length > 2 ? 'text-xs' : 'text-sm')}
      style={getAvatarStyle(profile?.avatar_color)}
    >
      {initials}
    </span>
  )

  // Écrans d'authentification (connexion, inscription, mot de passe oublié…) :
  // conçus plein écran, sans barre. Après tous les hooks (règle des hooks).
  if (pathname.startsWith('/auth/')) return null

  const showTabbar = !NO_TABBAR.some(re => re.test(pathname))

  return (
    <>
      {/* ─── Mobile : barre du haut ─────────────────────────────────────── */}
      <header
        id="app-topbar"
        className="md:hidden fixed top-0 inset-x-0 z-[1200] h-16 px-4 flex items-center gap-3 bg-glass backdrop-blur-xl backdrop-saturate-150 border-b border-edge"
      >
        <Link href={homeHref} className="flex items-center gap-2 min-w-0 font-semibold text-[17px] text-gray-900">
          <Image src="/logo_cedre.png" alt="" width={38} height={38} priority className="rounded-[10px] shrink-0" />
          <span className="truncate">Les voisins du Cèdre</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/demandes" aria-label="Mes demandes"
                className={cn(
                  'relative w-10 h-10 rounded-full flex items-center justify-center',
                  pathname.startsWith('/demandes') ? 'bg-brand-100 text-brand-700' : 'text-gray-700 hover:bg-gray-100',
                )}>
                <ClipboardList size={21} />
                {badge(pendingRequestsCount, 'absolute -top-0.5 -right-0.5')}
              </Link>
              <Link href="/profile" aria-label="Mon profil"
                className={cn('rounded-full', pathname === '/profile' && 'ring-2 ring-brand-600 ring-offset-2 ring-offset-surface')}>
                {avatar('w-10 h-10')}
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="px-3 py-2 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-100">
                Connexion
              </Link>
              <Link href="/auth/register" className="px-3.5 py-2 rounded-full text-sm font-semibold bg-brand-600 text-white">
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ─── Desktop : menu latéral flottant ────────────────────────────── */}
      <aside
        id="app-sidebar"
        className="hidden md:flex fixed z-[1200] left-3 top-3 bottom-3 w-[68px] lg:w-[240px] flex-col gap-4 p-2.5 lg:p-3 rounded-[22px] glass"
      >
        <Link href={homeHref} className="flex items-center gap-2.5 lg:px-1 justify-center lg:justify-start" aria-label="Les voisins du Cèdre — accueil">
          <Image src="/logo_cedre.png" alt="" width={40} height={40} priority className="rounded-xl shrink-0" />
          <span className="hidden lg:inline text-[15px] font-semibold tracking-tight text-gray-900 leading-tight">
            Les voisins du Cèdre
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {sidebarItems.map(item => {
            const active = isActive(item)
            const Icon = item.icon
            return (
              <Link key={item.label} href={item.href} title={item.label} aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative h-11 rounded-xl flex items-center gap-3 justify-center lg:justify-start lg:px-3 text-[15px] transition-colors',
                  // Sélection sobre, comme une barre latérale macOS : la même bulle
                  // gris translucide que la barre d'onglets mobile.
                  active ? 'bg-bubble shadow-bubble text-brand-700 font-semibold' : 'text-gray-900 hover:bg-gray-100',
                )}>
                {/* Icônes en vert, comme une barre latérale macOS teintée : le vert est la base de l'appli */}
                <Icon size={20} className="shrink-0 text-brand-600" />
                <span className="sr-only lg:not-sr-only">{item.label}</span>
                {badge(item.count, 'absolute top-1 right-1 lg:static lg:ml-auto')}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          {user ? (
            <>
              <Link href="/profile" title="Mon profil"
                className={cn(
                  'flex items-center gap-2.5 p-1.5 rounded-2xl justify-center lg:justify-start transition-colors',
                  pathname === '/profile' ? 'bg-brand-100' : 'hover:bg-gray-100',
                )}>
                {avatar('w-10 h-10')}
                <span className="hidden lg:flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold text-gray-900 truncate">{displayName}</span>
                  <span className="text-[13px] text-gray-500">Mon profil</span>
                </span>
              </Link>
              <button onClick={handleLogout} title="Déconnexion"
                className="h-10 rounded-xl flex items-center gap-3 justify-center lg:justify-start lg:px-3 text-[15px] text-red-600 hover:bg-red-50 transition-colors">
                <LogOut size={18} className="shrink-0" />
                <span className="sr-only lg:not-sr-only">Déconnexion</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="h-10 rounded-xl flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-gray-100">
                Connexion
              </Link>
              <Link href="/auth/register" className="h-10 rounded-xl flex items-center justify-center text-sm font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200">
                <span className="lg:hidden">Créer</span>
                <span className="hidden lg:inline">S&apos;inscrire</span>
              </Link>
            </>
          )}
        </div>
      </aside>

      {/* ─── Mobile : barre d'onglets flottante, avec sa goutte ──────────── */}
      {showTabbar && (
        <TabBar items={items} activeIndex={items.findIndex(isActive)} badge={badge} />
      )}
    </>
  )
}
