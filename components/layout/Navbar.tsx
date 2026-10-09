'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { MapPin, MessageCircle, LogOut, ClipboardList, CalendarDays, House, TreePine } from 'lucide-react'
import { useState, useEffect, useRef, type PointerEvent, type ReactNode, type Ref } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, getAvatarStyle, getInitials } from '@/lib/utils'
import { useUnreadCount, usePendingRequests } from '@/lib/hooks'
import { useTheme } from '@/components/theme/ThemeProvider'
import { useLoupe, type Lens } from '@/components/ui/useLoupe'
import GlassLens from '@/components/ui/GlassLens'
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
const INSET = 4
/**
 * Marge de la bulle autour de l'icône et du libellé, de chaque côté. 14 px dans
 * Fridge, qui n'a que trois onglets ; avec cinq, au-delà de 10 px la bulle de
 * « Messages » mordrait sur les libellés voisins.
 */
const PAD_X = 10
/** La loupe dépasse la bulle de 13 px de chaque côté, soit 8 px au-delà de la barre (comme Fridge). */
const GROW = 13

interface Slot {
  /** Bord gauche du contenu (icône + libellé), depuis le bord intérieur de la barre */
  left: number
  width: number
}

interface Bar {
  /** Largeur et hauteur intérieures (sans la bordure) */
  width: number
  height: number
  /** Épaisseur de la bordure */
  border: number
  slots: Slot[]
}

/** Onglet sous un point de la barre (abscisse depuis son bord intérieur gauche). */
function tabAt(x: number, bar: Bar) {
  const count = bar.slots.length
  return Math.min(count - 1, Math.max(0, Math.floor(((x - INSET) / (bar.width - INSET * 2)) * count)))
}

/** Largeur de la bulle autour du contenu d'un onglet. */
function bubbleWidth(bar: Bar, i: number) {
  return Math.min(bar.slots[i].width + PAD_X * 2, bar.width - INSET * 2)
}

/** Bord gauche d'une bulle centrée sur `center`, sans sortir de la barre. */
function bubbleLeft(bar: Bar, center: number, width: number) {
  return Math.min(Math.max(center - width / 2, INSET), bar.width - INSET - width)
}

type BadgeFn = (n: number | undefined, className?: string) => ReactNode

/** Icône, pastille et libellé d'un onglet : dans la barre, et agrandis dans la loupe. */
function TabContent({ item, badge, ref }: { item: NavItem; badge: BadgeFn; ref?: Ref<HTMLSpanElement> }) {
  const Icon = item.icon
  return (
    <span ref={ref} className="relative flex flex-col items-center gap-0.5 text-[10.5px] leading-[13px] font-semibold">
      <span className="relative flex">
        <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
        {/* Pastille sur le coin de l'icône : hors mesure de la bulle */}
        {badge(item.count, 'absolute -top-1.5 -right-3')}
      </span>
      {item.label}
    </span>
  )
}

/**
 * Barre d'onglets mobile : celle de l'app Fridge (2026-10-09, même verre et même
 * loupe), avec cinq onglets. Plus de bouton « + » à côté (2026-10-07) : il créait
 * une annonce même depuis le Quartier. Chaque page a son « + ».
 *
 * - **Verre léger** (`bg-glass-thin`, flou de 10 px) : au repos on devine le
 *   contenu qui défile dessous ; presque opaque (`bg-glass-pressed`) dès que le
 *   doigt s'y pose. Même liseré et même reflet que tout le verre de l'appli.
 * - **Bulle** : gris système translucide, taillée autour de l'icône et du libellé
 *   de l'onglet choisi (mesurés par un ResizeObserver).
 * - **Loupe** : doigt posé, la bulle se soulève en loupe de verre clair, plus
 *   grande que la barre (GlassLens) : elle rejoint le doigt, le suit d'un onglet
 *   à l'autre et agrandit les icônes et les libellés qu'elle couvre. Son bord
 *   floute et irise l'onglet voisin et la page qui passe dessous.
 * - Au lâcher, elle se pose sur l'onglet touché, ou sur le plus proche après un
 *   glissé, en s'étirant comme une goutte d'eau, sans attendre la page.
 * Avec « Réduire les animations », elle se déplace sans effet.
 */
function TabBar({ items, activeIndex, badge }: {
  items: NavItem[]
  activeIndex: number
  badge: BadgeFn
}) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const barRef = useRef<HTMLDivElement>(null)
  const contentRefs = useRef<(HTMLSpanElement | null)[]>([])
  const gesture = useRef<{ startX: number; dragging: boolean } | null>(null)
  const swallowClick = useRef(false)
  // Onglet visé au toucher, valable tant que l'URL n'a pas changé
  const [pending, setPending] = useState<{ index: number; from: string } | null>(null)
  const { lens, grab, follow, drop } = useLoupe()
  // La goutte ne se déforme qu'après un premier geste, pas à l'ouverture de l'appli
  const [touched, setTouched] = useState(false)
  const [bar, setBar] = useState<Bar | null>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect()
      setBar({
        width: el.clientWidth,
        height: el.clientHeight,
        border: el.clientLeft,
        slots: contentRefs.current.map(content => {
          const r = content?.getBoundingClientRect()
          return r ? { left: r.left - box.left - el.clientLeft, width: r.width } : { left: 0, width: 0 }
        }),
      })
    })
    observer.observe(el)
    // Les libellés s'élargissent à l'arrivée de la police : la bulle suit.
    contentRefs.current.forEach(content => content && observer.observe(content))
    return () => observer.disconnect()
  }, [])

  const index = pending && pending.from === pathname ? pending.index : activeIndex
  const lifted = lens !== null && bar !== null
  // Doigt posé : l'onglet sous la loupe prend la couleur de l'onglet choisi
  const highlighted = lifted ? tabAt(lens.center, bar) : index

  const localX = (clientX: number) => {
    const el = barRef.current!
    return clientX - el.getBoundingClientRect().left - el.clientLeft
  }

  /** La loupe vise le doigt, avec la largeur de l'onglet survolé. */
  const aim = (x: number): Lens => ({ center: x, width: bar ? bubbleWidth(bar, tabAt(x, bar)) : 0 })

  /** La bulle part tout de suite vers l'onglet, sans attendre la page. */
  const mark = (next: number) => {
    setTouched(true)
    setPending({ index: next, from: pathname })
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!bar) return
    gesture.current = { startX: e.clientX, dragging: false }
    swallowClick.current = false
    setTouched(true)
    // La loupe part de la bulle de l'onglet choisi pour rejoindre le doigt.
    const x = localX(e.clientX)
    const start = index >= 0 ? index : tabAt(x, bar)
    const width = bubbleWidth(bar, start)
    grab({ center: bubbleLeft(bar, bar.slots[start].left + bar.slots[start].width / 2, width) + width / 2, width }, aim(x))
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging && Math.abs(e.clientX - g.startX) >= 8) {
      g.dragging = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    follow(aim(localX(e.clientX)))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    drop()
    if (!g || !bar) return
    if (g.dragging) {
      swallowClick.current = true
      const next = tabAt(localX(e.clientX), bar)
      mark(next)
      if (next !== activeIndex) router.push(items[next].href)
      return
    }
    // Simple toucher : la bulle se pose sur l'onglet touché dès le lâcher, le
    // clic qui suit ouvre la page.
    const tab = e.type === 'pointerup' ? (e.target as Element).closest<HTMLElement>('[data-tab]') : null
    if (tab) mark(Number(tab.dataset.tab))
  }

  // Bulle : autour du contenu de l'onglet choisi, ou cachée sous la loupe, qu'elle
  // suit pour partir de là au lâcher.
  let bubble: { left: number; width: number } | null = null
  if (lifted) {
    bubble = { left: bubbleLeft(bar, lens.center, lens.width), width: lens.width }
  } else if (bar && index >= 0) {
    const width = bubbleWidth(bar, index)
    bubble = { left: bubbleLeft(bar, bar.slots[index].left + bar.slots[index].width / 2, width), width }
  }

  const columns = `repeat(${items.length}, minmax(0, 1fr))`

  return (
    <div
      id="app-tabbar"
      className="md:hidden fixed z-[1200] left-4 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <nav aria-label="Navigation principale">
        {/* La loupe est posée à côté de la barre, pas dedans : le flou de la barre
            limiterait le sien au contenu de la barre, et la page ne se verrait pas
            au travers de ce qui déborde. */}
        <div className="relative">
          <div
            ref={barRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onPointerLeave={() => {
              // Souris sortie sans glisser : la bulle se repose
              if (gesture.current && !gesture.current.dragging) { gesture.current = null; drop() }
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
              // Verre léger et peu flouté, même arête que le reste du verre (recette Fridge).
              // Pas de menu d'aperçu iOS sur un appui long : l'appui sert à la loupe.
              'relative grid h-[62px] touch-none select-none [-webkit-touch-callout:none] rounded-full border border-glass-rim p-1 shadow-sheen backdrop-blur-[10px] backdrop-saturate-[1.8] transition-colors duration-200',
              lifted ? 'bg-glass-pressed' : 'bg-glass-thin',
            )}
            style={{ gridTemplateColumns: columns }}
          >
            {bubble && (
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-y-1 left-0',
                  // Sous la loupe, elle la suit image par image, sans transition.
                  !lifted && 'transition-[transform,width] duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none',
                )}
                style={{ transform: `translateX(${bubble.left}px)`, width: bubble.width }}
              >
                <span
                  key={touched ? index : 'repos'}
                  className={cn(
                    'block h-full w-full rounded-full bg-bubble shadow-bubble',
                    lifted ? 'opacity-0' : touched && 'motion-safe:animate-bubble',
                  )}
                />
              </span>
            )}

            {items.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                // Préchargée en entier, comme dans Fridge : même /accueil et /messages,
                // dynamiques, s'ouvrent sans attendre le serveur.
                prefetch
                draggable={false}
                data-tab={i}
                onClick={() => mark(i)}
                aria-current={i === activeIndex ? 'page' : undefined}
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full transition-colors duration-300',
                  i === highlighted ? 'text-brand-700' : 'text-gray-500',
                )}
              >
                <TabContent
                  item={item}
                  badge={badge}
                  ref={el => {
                    contentRefs.current[i] = el
                  }}
                />
              </Link>
            ))}
          </div>
          {lifted && bubble && (
            <GlassLens
              rest={{
                left: bar.border + bubble.left,
                top: bar.border + INSET,
                width: bubble.width,
                height: bar.height - INSET * 2,
              }}
              grow={GROW}
              surface={{ left: bar.border, top: bar.border, width: bar.width, height: bar.height }}
              surfaceClassName="bg-loupe"
              content={{
                left: bar.border + INSET,
                top: bar.border + INSET,
                width: bar.width - INSET * 2,
                height: bar.height - INSET * 2,
              }}
              focus={bar.border + lens.center}
            >
              <span className="grid h-full" style={{ gridTemplateColumns: columns }}>
                {items.map((item, i) => (
                  <span
                    key={item.label}
                    className={cn('flex items-center justify-center', i === highlighted ? 'text-brand-700' : 'text-gray-500')}
                  >
                    <TabContent item={item} badge={badge} />
                  </span>
                ))}
              </span>
            </GlassLens>
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
  // Session connue (connecté ou non) : avant, on ne masque rien, pour ne pas faire
  // sauter la barre d'onglets d'un voisin connecté le temps de la lecture.
  const [authResolved, setAuthResolved] = useState(false)
  const [profile, setProfile] = useState<NavProfile | null>(null)
  // Compteurs factorisés dans lib/hooks.ts : un seul magasin et un seul abonnement
  // Realtime par compteur, quel que soit le nombre de pastilles affichées.
  const unreadCount = useUnreadCount()
  const pendingRequestsCount = usePendingRequests()
  const supabase = createClient()

  useEffect(() => {
    // `getSession()` et non `getUser()` : lecture locale, sans aller-retour réseau.
    // Avec `getUser()`, les onglets visaient « / » et la connexion, et la barre du
    // haut affichait « Connexion », le temps que le serveur d'auth réponde. Le
    // compte ne sert ici qu'à l'interface : le RLS reste le seul verrou.
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthResolved(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      setAuthResolved(true)
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

  // Les liens préchargent les onglets à l'ouverture (prefetch, en production). Au
  // retour au premier plan, le cache du routeur a pu expirer pendant la veille
  // (5 min) : on le remplit de nouveau, pour que le prochain toucher n'attende pas
  // le serveur. Repris de Fridge.
  const warmHrefs = [...sidebarItems.map(item => item.href), ...(user ? ['/profile'] : [])].join(' ')
  useEffect(() => {
    const warm = () => {
      if (document.visibilityState === 'visible') warmHrefs.split(' ').forEach(href => router.prefetch(href))
    }
    document.addEventListener('visibilitychange', warm)
    return () => document.removeEventListener('visibilitychange', warm)
  }, [router, warmHrefs])

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

  // Déconnecté, rien n'est accessible en dehors de l'accueil public et de la
  // connexion (2026-10-09, mobile puis web) : ni barre d'onglets, ni entrées du
  // menu latéral. La barre du haut et le menu ne proposent que « Connexion » et
  // « S'inscrire ». Même chose sur les écrans d'auth (connexion, inscription, mot
  // de passe oublié…), qui gardent pourtant la barre du haut et le menu (« je
  // perds le header, c'est bizarre »). L'accueil public `/` n'est servi qu'aux
  // visiteurs sans compte (le serveur redirige les autres) : rien à attendre.
  const isAuthPage = pathname.startsWith('/auth/')
  const loggedOut = authResolved && !user
  const navHidden = isAuthPage || loggedOut || pathname === '/'
  const showTabbar = !navHidden && !NO_TABBAR.some(re => re.test(pathname))

  return (
    <>
      {/* ─── Mobile : barre du haut ─────────────────────────────────────── */}
      <header
        id="app-topbar"
        // Le verre de toute l'appli (`.glass`), collé au bord : liseré en bas seulement
        // 4,5 rem depuis le 2026-10-09 (« agrandis un peu le header, en hauteur ») ; à garder égal à --nav-top
        className="md:hidden fixed top-0 inset-x-0 z-[1200] h-[4.5rem] px-4 flex items-center gap-3 glass rounded-none border-x-0 border-t-0"
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

        {!navHidden && <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {sidebarItems.map(item => {
            const active = isActive(item)
            const Icon = item.icon
            return (
              <Link key={item.label} href={item.href} title={item.label} aria-current={active ? 'page' : undefined}
                // Préchargée en entier, comme la barre d'onglets mobile
                prefetch
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
        </nav>}

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
