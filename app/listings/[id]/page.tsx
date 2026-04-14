import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Clock, ArrowLeft, Star, MessageCircle } from 'lucide-react'
import { isListingType, LISTING_TYPE_LABELS, LISTING_TYPE_COLORS, LISTING_STATUS_LABELS, LISTING_STATUS_COLORS, type Listing } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { ContactButton } from '@/components/listings/ContactButton'
import { ListingActions } from '@/components/listings/ListingActions'

type ListingWithJoins = Listing

export default async function ListingPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*, profiles!user_id(*), categories(*)')
    .eq('id', params.id)
    .single()

  if (listingError || !listing) notFound()

  const typedListing = listing as unknown as ListingWithJoins
  const listingType = isListingType(typedListing.type) ? typedListing.type : 'pret'

  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === typedListing.user_id
  const isResponder = user?.id === typedListing.responder_id

  // Profil du répondant (si existant)
  let responderProfile = null
  if (typedListing.responder_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, rating, rating_count')
      .eq('id', typedListing.responder_id)
      .single()
    responderProfile = data
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/map" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Retour à la carte
      </Link>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Image */}
        {typedListing.image_url ? (
          <div className="relative w-full max-h-[40vh] bg-gray-100">
            <Image src={typedListing.image_url} alt={typedListing.title} width={0} height={0} sizes="100vw" className="w-full h-auto max-h-[40vh] object-contain" />
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
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${LISTING_TYPE_COLORS[listingType]}`}>
                {LISTING_TYPE_LABELS[listingType]}
              </span>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${LISTING_STATUS_COLORS[typedListing.status]}`}>
                {LISTING_STATUS_LABELS[typedListing.status]}
              </span>
            </div>
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

          <div className="border-t border-gray-100" />

          {/* Profil du propriétaire */}
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

          {/* Bloc répondant (visible owner) */}
          {isOwner && responderProfile && (typedListing.status === 'en_cours' || typedListing.status === 'validee') && (
            <>
              <div className="border-t border-gray-100" />
              <div className="bg-orange-50 rounded-2xl p-4">
                <p className="text-xs font-medium text-orange-600 mb-2 uppercase tracking-wide">
                  {typedListing.status === 'validee' ? '✅ Demande validée' : '⏳ Demande en cours'}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-sm">
                    {responderProfile.full_name?.[0] || responderProfile.username?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">{responderProfile.full_name || responderProfile.username}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Star size={11} className="text-yellow-400 fill-yellow-400" />
                      {responderProfile.rating?.toFixed(1) || '—'}
                      <span>({responderProfile.rating_count || 0} avis)</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actions interactives (client component) */}
          {user && (
            <ListingActions
              listingId={typedListing.id}
              status={typedListing.status}
              conversationId={typedListing.conversation_id ?? null}
              isOwner={isOwner}
              isResponder={isResponder}
            />
          )}

          {/* Bouton contacter (non propriétaire connecté) */}
          {!isOwner && !isResponder && user && (
            <ContactButton
              listingId={typedListing.id}
              receiverId={typedListing.user_id}
              listingStatus={typedListing.status}
            />
          )}

          {/* Modifier (owner) */}
          {isOwner && (
            <Link href={`/listings/${typedListing.id}/edit`}
              className="w-full py-3 text-center bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm">
              Modifier l&apos;annonce
            </Link>
          )}

          {/* Non connecté */}
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
