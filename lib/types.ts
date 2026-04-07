export type ListingType = 'pret' | 'don' | 'echange' | 'service'
export type ListingStatus = 'disponible' | 'reserve' | 'termine'

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
  created_at: string
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

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  pret: 'Prêt',
  don: 'Don',
  echange: 'Échange',
  service: 'Service',
}

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  disponible: 'Disponible',
  reserve: 'Réservé',
  termine: 'Terminé',
}

export const LISTING_TYPE_COLORS: Record<ListingType, string> = {
  pret: 'bg-blue-100 text-blue-700',
  don: 'bg-green-100 text-green-700',
  echange: 'bg-purple-100 text-purple-700',
  service: 'bg-orange-100 text-orange-700',
}
