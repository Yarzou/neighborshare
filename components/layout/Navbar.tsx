'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { MapPin, MessageCircle, User, LogOut, Menu, X, ClipboardList, CalendarDays, Home, Megaphone } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, getAvatarStyle } from '@/lib/utils'
import { useUnreadCount, usePendingRequests } from '@/lib/hooks'
import { useTheme } from '@/components/theme/ThemeProvider'
import type { User as SupabaseUser } from '@supabase/supabase-js'

/** Le strict nécessaire pour la pastille d'avatar du coin droit (desktop). */
interface NavProfile {
  full_name: string | null
  username: string | null
  avatar_color: string | null
}

function initialsOf(p: NavProfile | null, fallback: string | undefined): string {
  const name = p?.full_name?.trim() || p?.username?.trim() || fallback || ''
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name.slice(0, 2) || '?').toUpperCase()
}

/**
 * Barre de navigation.
 *
 * Desktop (md+), disposition validée sur maquette : logo + nom, puis les trois
 * sections (Carte, Événements, Quartier) juste à côté ; à droite, Demandes et
 * Messages avec leurs compteurs, puis la pastille d'avatar (initiales, couleur
 * du profil) qui mène au profil, et la déconnexion. Fond `surface-header` et
 * liseré vert de 3 px en bas — ce sont les tokens qui portent le mode sombre.
 *
 * Mobile : inchangé (logo + bouton menu, menu déroulant).
 */
export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme } = useTheme()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<NavProfile | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // Compteurs factorisés dans lib/hooks.ts — ils portent leur propre session,
  // leur propre abonnement Realtime et le repli sur le changement de route.
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

  const navLinks = [
    { href: '/map', label: 'Carte', icon: <MapPin size={16} /> },
    { href: '/evenements', label: 'Événements', icon: <CalendarDays size={16} /> },
    // Section « Quartier » = 4 pages sous onglets (layout du route group (quartier)) :
    // le lien reste actif sur chacune d'elles, pas seulement sur /infos.
    { href: '/infos', label: 'Quartier', icon: <Megaphone size={16} />,
      matches: ['/infos', '/achats', '/prestataires', '/documents'] },
  ]

  const isNavLinkActive = (link: { href: string; matches?: string[] }) =>
    (link.matches ?? [link.href]).some(p => pathname?.startsWith(p))

  const handleProfile = () => {
    if (user) {
      router.push('/profile')
    } else {
      router.push('/auth/login?redirect=%2Fprofile')
    }
  }

  const handleMessages = () => {
    if (user) {
      router.push('/messages')
    } else {
      router.push('/auth/login?redirect=%2Fmessages')
    }
  }

  const handleDemandes = () => {
    if (user) {
      router.push('/demandes')
    } else {
      router.push('/auth/login?redirect=%2Fdemandes')
    }
  }

  const desktopLink = (active: boolean) => cn(
    'relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors',
    active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100',
  )

  const counter = (n: number) => n > 0 && (
    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
      {n > 9 ? '9+' : n}
    </span>
  )

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1200] bg-surface-header border-b-[3px] border-brand-600">
      <div className="px-4 md:px-6 h-16 flex items-center gap-2 md:gap-8">
        {/* Logo */}
        <Link href={user ? '/accueil' : '/'} className="flex items-center gap-2 font-bold text-brand-700 text-lg shrink-0">
          {/* `priority` : le logo est visible d'emblée sur toutes les pages, il
              n'a aucune raison d'être chargé paresseusement. */}
          <Image src="/logo_cedre.png" alt="Logo" width={50} height={50} priority className="rounded-lg" />
          <span>Les voisins du Cèdre</span>
        </Link>

        {/* Desktop : sections, juste à côté du nom */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={desktopLink(isNavLinkActive(link))}>
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop : espace personnel, à droite */}
        <div className="hidden md:flex items-center gap-1 ml-auto">
          {user ? (
            <>
              <button onClick={handleDemandes} className={desktopLink(!!pathname?.startsWith('/demandes'))}>
                <ClipboardList size={16} /> Demandes
                {counter(pendingRequestsCount)}
              </button>
              <button onClick={handleMessages} className={desktopLink(!!pathname?.startsWith('/messages'))}>
                <MessageCircle size={16} /> Messages
                {counter(unreadCount)}
              </button>
              <button
                onClick={handleProfile}
                aria-label="Mon profil"
                title={profile?.full_name || profile?.username || 'Mon profil'}
                className={cn(
                  'ml-2 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-shadow',
                  pathname === '/profile' ? 'ring-2 ring-brand-600 ring-offset-2 ring-offset-surface-header' : 'hover:ring-2 hover:ring-brand-300',
                )}
                style={getAvatarStyle(profile?.avatar_color)}
              >
                {initialsOf(profile, user.email ?? undefined)}
              </button>
              <button onClick={handleLogout} aria-label="Déconnexion" title="Déconnexion"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                Connexion
              </Link>
              <Link href="/auth/register" className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden ml-auto p-2 rounded-lg hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface-raised border-t border-edge px-4 py-3 flex flex-col gap-1">
          {user && (
            <Link href="/accueil" onClick={() => setMenuOpen(false)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium',
                pathname === '/accueil' ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100'
              )}>
              <Home size={16} /> Accueil
            </Link>
          )}
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
              {link.icon} {link.label}
            </Link>
          ))}
          {user && (
            <button onClick={() => { handleDemandes(); setMenuOpen(false) }}
              className={cn(
                'relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-100',
                pathname?.startsWith('/demandes') ? 'text-brand-700' : 'text-gray-700'
              )}>
              <ClipboardList size={16} /> Demandes
              {pendingRequestsCount > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </span>
              )}
            </button>
          )}
          {user && (
            <button onClick={() => { handleMessages(); setMenuOpen(false) }}
              className={cn(
                'relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-100',
                pathname?.startsWith('/messages') ? 'text-brand-700' : 'text-gray-700'
              )}>
              <MessageCircle size={16} /> Messages
              {unreadCount > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          <div className="border-t border-gray-100 mt-2 pt-2">
            {user ? (
              <>
                <button onClick={() => { handleProfile(); setMenuOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
                  <User size={16} /> Profil
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50">
                  <LogOut size={16} /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
                  Connexion
                </Link>
                <Link href="/auth/register" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 mt-1">
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
