'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { MapPin, MessageCircle, User, LogOut, Menu, X, ClipboardList, CalendarDays, Home, Megaphone } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useUnreadCount, usePendingRequests } from '@/lib/hooks'
import { useTheme } from '@/components/theme/ThemeProvider'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme } = useTheme()
  const [user, setUser] = useState<SupabaseUser | null>(null)
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

  const handleLogout = async () => {
    setTheme('system')
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/map', label: 'Carte', icon: <MapPin size={16} /> },
    { href: '/evenements', label: 'Événements', icon: <CalendarDays size={16} /> },
    // Section « Quartier » = 3 pages sous onglets (layout du route group (quartier)) :
    // le lien reste actif sur chacune d'elles, pas seulement sur /infos.
    { href: '/infos', label: 'Quartier', icon: <Megaphone size={16} />,
      matches: ['/infos', '/achats', '/prestataires'] },
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

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1200] bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href={user ? '/accueil' : '/'} className="flex items-center gap-2 font-bold text-brand-700 text-lg">
          {/* `priority` : le logo est visible d'emblée sur toutes les pages, il
              n'a aucune raison d'être chargé paresseusement. */}
          <Image src="/logo_cedre.png" alt="Logo" width={50} height={50} priority className="rounded-lg" />
          <span>Les voisins du Cèdre</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                isNavLinkActive(link)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}>
              {link.icon}
              {link.label}
            </Link>
          ))}
          {user && (
            <button onClick={handleDemandes}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                pathname?.startsWith('/demandes')
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}>
              <ClipboardList size={16} /> Demandes
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </span>
              )}
            </button>
          )}
          {user && (
            <button onClick={handleMessages}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                pathname?.startsWith('/messages')
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}>
              <MessageCircle size={16} /> Messages
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Auth */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <button onClick={handleProfile}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  pathname === '/profile' ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                )}>
                <User size={16} /> Profil
              </button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={16} /> Déconnexion
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
        <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 flex flex-col gap-1">
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
