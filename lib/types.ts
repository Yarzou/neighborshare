export type ListingType = 'pret' | 'don' | 'echange' | 'service' | 'vente'
export type ListingStatus = 'disponible' | 'reserve' | 'termine' | 'en_cours' | 'validee'
export type ChildcareMode = 'demande' | 'offre'
export type ListingIntent = 'offre' | 'demande'

export type ChildcareSlot =
  | { type: 'recurring'; day: 0 | 1 | 2 | 3 | 4 | 5 | 6; start_time: string; end_time: string }
  | { type: 'once'; date: string; start_time: string; end_time: string }
// recurring.day: 0=Dimanche, 1=Lundi, ..., 6=Samedi (convention JS)
// times: format "HH:mm"

export const LISTING_TYPES = ['pret', 'don', 'echange', 'service', 'vente'] as const

export function isListingType(value: unknown): value is ListingType {
  return typeof value === 'string' && (LISTING_TYPES as readonly string[]).includes(value)
}

export interface Category {
  id: number
  slug: string
  label: string
  icon: string
}

export interface Profile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  rating: number
  rating_count: number
  created_at: string
  email_notifications_enabled?: boolean
  push_notifications_enabled?: boolean
  avatar_color?: string | null
}

export interface Listing {
  id: string
  user_id: string
  category_id: number | null
  title: string
  description: string | null
  type: ListingType
  status: ListingStatus
  image_url: string | null
  address: string | null
  city: string | null
  carpool_departure_address: string | null
  carpool_departure_lat: number | null
  carpool_departure_lng: number | null
  carpool_arrival_address: string | null
  carpool_arrival_lat: number | null
  carpool_arrival_lng: number | null
  childcare_start_at: string | null
  childcare_end_at: string | null
  childcare_mode: ChildcareMode | null
  childcare_slots: ChildcareSlot[] | null
  listing_intent: ListingIntent
  expires_at: string | null
  price: number | null
  created_at: string
  responder_id?: string | null
  conversation_id?: string | null
  // From RPC function
  distance_m?: number
  lat_out?: number
  lng_out?: number
  // Joins
  profiles?: Profile
  categories?: Category
}

export interface Message {
  id: string
  listing_id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at: string
  sender?: Profile
  receiver?: Profile
}

export interface Conversation {
  id: string
  name: string | null
  created_at: string
  updated_at: string
}

export interface ConversationParticipant {
  conversation_id: string
  user_id: string
  last_read_at: string
  joined_at: string
  profiles?: Profile
}

export interface DirectMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export interface ConversationWithDetails extends Conversation {
  participants: ConversationParticipant[]
  lastMessage: DirectMessage | null
  unreadCount: number
}

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  pret: 'Prêt',
  don: 'Don',
  echange: 'Échange',
  service: 'Service',
  vente: 'Vente',
}

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  disponible: 'Disponible',
  reserve: 'Réservé',
  termine: 'Terminé',
  en_cours: 'En cours',
  validee: 'Validée',
}

export const LISTING_STATUS_COLORS: Record<ListingStatus, string> = {
  disponible: 'bg-green-100 text-green-700',
  reserve: 'bg-yellow-100 text-yellow-700',
  termine: 'bg-gray-100 text-gray-500',
  en_cours: 'bg-orange-100 text-orange-700',
  validee: 'bg-brand-100 text-brand-700',
}

export const LISTING_TYPE_COLORS: Record<ListingType, string> = {
  pret: 'bg-blue-100 text-blue-700',
  don: 'bg-green-100 text-green-700',
  echange: 'bg-purple-100 text-purple-700',
  service: 'bg-orange-100 text-orange-700',
  vente: 'bg-red-100 text-red-700',
}
