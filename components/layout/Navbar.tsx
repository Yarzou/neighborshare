'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { MapPin, Plus, MessageCircle, User, LogOut, Menu, X, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Fetch unread count whenever user changes or path changes (messages page marks as read)
  useEffect(() => {
    if (!user) { setUnreadCount(0); return }

    const fetchUnread = async () => {
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)

      if (!parts || parts.length === 0) { setUnreadCount(0); return }

      let total = 0
      await Promise.all(parts.map(async (p) => {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .neq('sender_id', user.id)
          .gt('created_at', p.last_read_at)
        total += count ?? 0
      }))
      setUnreadCount(total)
    }

    fetchUnread()

    // Realtime: met à jour le badge dès qu'un nouveau message arrive
    const channel = supabase
      .channel('navbar_unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchUnread()
      })
      // Quand l'utilisateur lit une conversation, last_read_at est mis à jour
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants',
        filter: `user_id=eq.${user.id}` }, () => {
        fetchUnread()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/map', label: 'Carte', icon: <MapPin size={16} /> },
  ]

  const handlePublish = () => {
    if (user) {
      router.push('/listings/new')
    } else {
      router.push('/auth/login?redirect=%2Flistings%2Fnew')
    }
  }

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1200] bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href={user ? '/map' : '/'} className="flex items-center gap-2 font-bold text-brand-700 text-lg">
          <Image src="/logo_cedre.png" alt="Logo" width={50} height={50} className="rounded-lg" />
          <span>Les voisins du Cèdre</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}>
              {link.icon}
              {link.label}
            </Link>
          ))}
          <button onClick={handlePublish}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              pathname === '/listings/new'
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}>
            <Plus size={16} /> Publier
          </button>
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
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
              {link.icon} {link.label}
            </Link>
          ))}
          <button onClick={() => { handlePublish(); setMenuOpen(false) }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100">
            <Plus size={16} /> Publier
          </button>
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
