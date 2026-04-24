import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Clock, ArrowLeft, CalendarDays, MessageCircle, RefreshCw } from 'lucide-react'
import { isListingType, LISTING_TYPE_LABELS, LISTING_TYPE_COLORS, LISTING_STATUS_LABELS, LISTING_STATUS_COLORS, type Listing } from '@/lib/types'
import { formatDate, formatChildcarePeriod, formatChildcareSlots } from '@/lib/utils'
import { ContactButton } from '@/components/listings/ContactButton'
import { ListingActions } from '@/components/listings/ListingActions'
import CarpoolMiniMap from '@/components/map/CarpoolMiniMapDynamic'

type ListingWithJoins = Listing

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*, profiles!user_id(*), categories(*)')
    .eq('id', id)
    .single()

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
        {/* Image ou carte covoiturage ou garde d'enfant */}
        {typedListing.carpool_departure_lat && typedListing.carpool_arrival_lat ? (
          <div className="w-full">
            <CarpoolMiniMap
              departureLat={typedListing.carpool_departure_lat}
              departureLng={typedListing.carpool_departure_lng!}
              departureLabel={typedListing.carpool_departure_address ?? 'Départ'}
              arrivalLat={typedListing.carpool_arrival_lat}
              arrivalLng={typedListing.carpool_arrival_lng!}
              arrivalLabel={typedListing.carpool_arrival_address ?? 'Arrivée'}
              className="w-full h-56"
            />
            <div className="flex flex-col gap-1 px-4 py-3 bg-indigo-50 border-b border-indigo-100 text-sm">
              <span className="flex items-center gap-2 text-green-700 font-medium">
                <span className="text-base">🟢</span> {typedListing.carpool_departure_address}
              </span>
              <span className="flex items-center gap-2 text-red-700 font-medium">
                <span className="text-base">🔴</span> {typedListing.carpool_arrival_address}
              </span>
            </div>
          </div>
        ) : typedListing.childcare_slots && typedListing.childcare_slots.length > 0 ? (
          <div className="w-full bg-violet-50 border-b border-violet-100">
            <div className="flex flex-col items-center justify-center gap-3 py-8 px-6">
              <CalendarDays size={36} className="text-violet-400" />
              <div className="text-center w-full">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-400 mb-3">Disponibilités proposées</p>
                {/* Recurring slots */}
                {typedListing.childcare_slots.filter(s => s.type === 'recurring').length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-violet-400 uppercase tracking-wide mb-1.5 flex items-center justify-center gap-1">
                      <RefreshCw size={11} /> Récurrents
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {typedListing.childcare_slots.filter(s => s.type === 'recurring').map((s, i) => {
                        const slot = s as Extract<typeof s, { type: 'recurring' }>
                        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
                        return (
                          <span key={i} className="bg-violet-100 text-violet-800 text-xs font-medium px-2.5 py-1 rounded-full">
                            {days[slot.day]} {slot.start_time.replace(':', 'h')}–{slot.end_time.replace(':', 'h')}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Once slots */}
                {typedListing.childcare_slots.filter(s => s.type === 'once').length > 0 && (
                  <div>
                    <p className="text-xs text-violet-400 uppercase tracking-wide mb-1.5 mt-2 flex items-center justify-center gap-1">
                      <CalendarDays size={11} /> Ponctuels
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {typedListing.childcare_slots.filter(s => s.type === 'once').map((s, i) => {
                        const slot = s as Extract<typeof s, { type: 'once' }>
                        const label = new Date(slot.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                        return (
                          <span key={i} className="bg-violet-100 text-violet-800 text-xs font-medium px-2.5 py-1 rounded-full">
                            {label} {slot.start_time.replace(':', 'h')}–{slot.end_time.replace(':', 'h')}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : typedListing.childcare_start_at && typedListing.childcare_end_at ? (() => {
          const { startLabel, endLabel, sameDay } = formatChildcarePeriod(typedListing.childcare_start_at!, typedListing.childcare_end_at!)
          return (
            <div className="w-full bg-violet-50 border-b border-violet-100">
              <div className="flex flex-col items-center justify-center gap-3 py-8 px-6">
                <CalendarDays size={36} className="text-violet-400" />
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-400 mb-2">Période de garde</p>
                  <p className="text-base font-semibold text-violet-800">{startLabel}</p>
                  {sameDay ? (
                    <p className="text-sm text-violet-600">jusqu&apos;à {endLabel}</p>
                  ) : (
                    <p className="text-sm text-violet-600">→ {endLabel}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })() : typedListing.image_url ? (
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
          <Link href={`/profil/${listing.user_id}`} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold group-hover:bg-brand-200 transition-colors">
              {listing.profiles?.full_name?.[0] || listing.profiles?.username?.[0] || '?'}
            </div>
            <div>
              <div className="font-medium text-sm group-hover:text-brand-600 transition-colors">{listing.profiles?.full_name || listing.profiles?.username}</div>
            </div>
          </Link>

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
