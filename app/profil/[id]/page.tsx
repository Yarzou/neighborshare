import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getAvatarStyle } from '@/lib/utils'
import PublicProfileAccordion from '@/components/profil/PublicProfileAccordion'

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Lecture réservée aux authentifiés (migration 030) : sans cette garde un
  // visiteur déconnecté verrait un 404 trompeur au lieu d'être invité à se connecter.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?redirect=/profil/${id}`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, username, bio, avatar_url, avatar_color')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const [{ data: listings }, { data: events }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, description, type, listing_intent, image_url')
      .eq('user_id', id)
      .eq('status', 'disponible')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('events')
      .select('id, title, description, event_date, image_urls')
      .eq('user_id', id)
      .order('event_date', { ascending: false })
      .limit(100),
  ])

  const displayName = profile.full_name || profile.username || 'Voisin'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={16} /> Retour à la carte
      </Link>

      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={getAvatarStyle(profile.avatar_color)}
        >
          {initial}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
          {profile.bio && <p className="text-sm text-gray-500 mt-0.5">{profile.bio}</p>}
        </div>
      </div>

      <PublicProfileAccordion
        listings={listings ?? []}
        events={events ?? []}
      />
    </div>
  )
}

