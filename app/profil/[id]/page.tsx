import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { LISTING_TYPE_LABELS, LISTING_TYPE_COLORS } from '@/lib/types'
import { formatDate, cn } from '@/lib/utils'

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, username, bio, rating, rating_count, avatar_url')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, description, type, category_id, listing_intent, created_at, image_url')
    .eq('user_id', id)
    .eq('status', 'disponible')
    .order('created_at', { ascending: false })

  const displayName = profile.full_name || profile.username || 'Voisin'
  const initial = displayName.charAt(0).toUpperCase()
  const rating = profile.rating ?? 0
  const ratingCount = profile.rating_count ?? 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={16} /> Retour à la carte
      </Link>

      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-700 flex-shrink-0">
          {initial}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
          {profile.bio && <p className="text-sm text-gray-500 mt-0.5">{profile.bio}</p>}
          {ratingCount > 0 ? (
            <div className="flex items-center gap-1 mt-1">
              <Star size={14} className="text-amber-400 fill-amber-400" />
              <span className="text-sm font-medium">{rating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({ratingCount} avis)</span>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">Pas encore d&apos;avis</p>
          )}
        </div>
      </div>

      {/* Listings */}
      <h2 className="text-base font-semibold text-gray-800 mb-4">
        Annonces actives{listings && listings.length > 0 ? ` · ${listings.length}` : ''}
      </h2>

      {!listings || listings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Aucune annonce active pour le moment.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map(listing => (
            <Link key={listing.id} href={`/listings/${listing.id}`}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors group">
              {listing.image_url ? (
                <img src={listing.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">📦</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {listing.listing_intent === 'demande' && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Recherche</span>
                  )}
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', LISTING_TYPE_COLORS[listing.type as keyof typeof LISTING_TYPE_COLORS])}>
                    {LISTING_TYPE_LABELS[listing.type as keyof typeof LISTING_TYPE_LABELS]}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
                {listing.description && (
                  <p className="text-xs text-gray-400 line-clamp-1">{listing.description}</p>
                )}
              </div>
              <span className="text-xs text-gray-300 group-hover:text-gray-400 transition-colors">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
