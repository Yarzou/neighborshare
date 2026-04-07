import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Clock, ArrowLeft, Star, MessageCircle } from 'lucide-react'
import { isListingType, LISTING_TYPE_LABELS, LISTING_TYPE_COLORS, type Listing } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { ContactButton } from '@/components/listings/ContactButton'

type ListingWithJoins = Listing

export default async function ListingPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('*, profiles(*), categories(*)')
    .eq('id', params.id)
    .single()

  if (!listing) notFound()

  // Supabase ne typant pas forcément le résultat, on force un type côté UI.
  const typedListing = listing as unknown as ListingWithJoins
  const listingType = isListingType(typedListing.type) ? typedListing.type : 'pret'

  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === typedListing.user_id

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/map" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Retour à la carte
      </Link>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Image */}
        {typedListing.image_url ? (
          <div className="relative w-full h-64">
            <Image src={typedListing.image_url} alt={typedListing.title} fill className="object-cover" />
          </div>
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-6xl">
            {typedListing.categories?.icon || '📍'}
          </div>
        )}

        <div className="p-6 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900">{typedListing.title}</h1>
            <span className={`text-sm font-medium px-3 py-1 rounded-full flex-shrink-0 ${LISTING_TYPE_COLORS[listingType]}`}>
              {LISTING_TYPE_LABELS[listingType]}
            </span>
          </div>

          {/* Catégorie + date */}
          <div className="flex items-center gap-4 text-sm text-gray-400">
            {typedListing.categories && (
              <span>{typedListing.categories.icon} {typedListing.categories.label}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={13} /> {formatDate(typedListing.created_at)}
            </span>
            {typedListing.city && (
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {typedListing.city}
              </span>
            )}
          </div>

          {/* Description */}
          {typedListing.description && (
            <p className="text-gray-600 leading-relaxed">{typedListing.description}</p>
          )}

          {/* Separator */}
          <div className="border-t border-gray-100" />

          {/* Profil */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
              {listing.profiles?.full_name?.[0] || listing.profiles?.username?.[0] || '?'}
            </div>
            <div>
              <div className="font-medium text-sm">{listing.profiles?.full_name || listing.profiles?.username}</div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                {listing.profiles?.rating?.toFixed(1) || '—'}
                <span>({listing.profiles?.rating_count || 0} avis)</span>
              </div>
            </div>
          </div>

          {/* Action */}
          {!isOwner && user && (
            <ContactButton listingId={typedListing.id} receiverId={typedListing.user_id} />
          )}

          {isOwner && (
            <div className="flex gap-3">
              <Link href={`/listings/${typedListing.id}/edit`}
                className="flex-1 py-3 text-center bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm">
                Modifier l&apos;annonce
              </Link>
            </div>
          )}

          {!user && (
            <Link href={`/auth/login?redirect=/listings/${typedListing.id}`}
              className="w-full py-3 text-center bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-colors text-sm flex items-center justify-center gap-2">
              <MessageCircle size={16} /> Connectez-vous pour contacter
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
