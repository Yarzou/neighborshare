export type ListingType = 'pret' | 'don' | 'echange' | 'service' | 'vente'
export type ListingStatus = 'disponible' | 'reserve' | 'termine' | 'en_cours' | 'validee'
export type ChildcareMode = 'demande' | 'offre'
export type ListingIntent = 'offre' | 'demande'

export type ChildcareSlot =
  | { type: 'recurring'; day: 0 | 1 | 2 | 3 | 4 | 5 | 6; start_time: string; end_time: string }
  | { type: 'once'; date: string; start_time: string; end_time: string }
// recurring.day: 0=Dimanche, 1=Lundi, ..., 6=Samedi (convention JS)
// times: format "HH:mm"

export type BookCondition = 'neuf' | 'tres_bon' | 'bon' | 'acceptable' | 'abime'

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
  address_display?: string | null
  address_road?: string | null
  address_city?: string | null
  address_lat?: number | null
  address_lng?: number | null
  /** Référent du lotissement : peut publier les informations officielles et les sondages */
  is_referent?: boolean
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
  book_author: string | null
  book_condition: BookCondition | null
  book_genre: string | null
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
  /** Conversation masquée par cet utilisateur (soft delete, migration 015). */
  deleted_at?: string | null
  /** Coupure d'historique posée à la suppression (migration 016). */
  visible_from?: string | null
  profiles?: Profile
}

export interface DirectMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  is_system?: boolean
  profiles?: Profile
  reactions?: MessageReaction[]
}

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface Event {
  id: string
  user_id: string
  title: string
  description: string | null
  event_date: string
  event_end_date: string | null
  location_text: string | null
  location_lat: number | null
  location_lng: number | null
  image_urls: string[]
  created_at: string
  // Join
  profiles?: Profile
}

/** Information officielle publiée par un référent du lotissement */
export interface Announcement {
  id: string
  author_id: string
  title: string
  body: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  // Join
  profiles?: Profile
}

/** Prestataire recommandé par un voisin */
export interface Provider {
  id: string
  created_by: string
  name: string
  trade: string
  phone: string | null
  email: string | null
  website: string | null
  comment: string | null
  created_at: string
  updated_at: string
  // Join
  profiles?: Profile
}

export type GroupPurchaseStatus = 'ouvert' | 'cloture' | 'annule'

export interface GroupPurchase {
  id: string
  created_by: string
  title: string
  description: string | null
  /** Unité libre : « litres », « stères », « kg »… */
  unit: string
  target_quantity: number | null
  unit_price: number | null
  deadline: string | null
  status: GroupPurchaseStatus
  created_at: string
  updated_at: string
  // Joins
  profiles?: Profile
  group_purchase_participants?: GroupPurchaseParticipant[]
}

export interface GroupPurchaseParticipant {
  purchase_id: string
  user_id: string
  quantity: number
  comment: string | null
  created_at: string
  updated_at: string
  // Join
  profiles?: Profile
}

export interface Poll {
  id: string
  created_by: string
  question: string
  description: string | null
  closes_at: string | null
  created_at: string
  // Joins
  poll_options?: PollOption[]
  profiles?: Profile
}

export interface PollOption {
  id: string
  poll_id: string
  label: string
  position: number
}

/** Ligne renvoyée par le RPC `poll_results` (refuse de répondre avant d'avoir voté) */
export interface PollResult {
  option_id: string
  label: string
  votes: number
}

export const GROUP_PURCHASE_STATUS_LABELS: Record<GroupPurchaseStatus, string> = {
  ouvert: 'Ouvert',
  cloture: 'Clôturé',
  annule: 'Annulé',
}

export const GROUP_PURCHASE_STATUS_COLORS: Record<GroupPurchaseStatus, string> = {
  ouvert: 'bg-emerald-100 text-emerald-700',
  cloture: 'bg-gray-200 text-gray-500',
  annule: 'bg-rose-100 text-rose-700',
}

export const MESSAGE_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
export type MessageEmoji = typeof MESSAGE_EMOJIS[number]

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
  validee: 'En utilisation',
}

// Refonte « Verre et Cèdre » (2026-10-06) : tout reste dans les verts, donc un
// statut ne se reconnaît jamais à sa teinte. Il se distingue par sa forme — plein,
// contour ou gris —, par une icône (STATUS_ICONS de StatusBadge) et par son libellé.
// « Disponible » (plein) et « En cours » (contour) s'opposent en luminosité.
export const LISTING_STATUS_COLORS: Record<ListingStatus, string> = {
  disponible: 'bg-brand-600 text-white',
  reserve: 'ring-1 ring-inset ring-current text-gray-800',
  termine: 'bg-gray-200 text-gray-600',
  en_cours: 'ring-1 ring-inset ring-current text-gray-800',
  validee: 'bg-brand-100 text-brand-700',
}

// Les cinq types partagent une pastille neutre ; c'est la lettre (LISTING_TYPE_SHORT),
// sur la couleur du type (LISTING_TYPE_MARKER_COLORS) dans TypeBadge, qui les distingue.
export const LISTING_TYPE_COLORS: Record<ListingType, string> = {
  pret: 'bg-gray-100 text-gray-800',
  don: 'bg-gray-100 text-gray-800',
  echange: 'bg-gray-100 text-gray-800',
  service: 'bg-gray-100 text-gray-800',
  vente: 'bg-gray-100 text-gray-800',
}

/** Lettre portée par le marqueur de la carte, en plus de la couleur du type */
export const LISTING_TYPE_SHORT: Record<ListingType, string> = {
  pret: 'P',
  don: 'D',
  echange: 'É',
  service: 'S',
  vente: 'V',
}

/**
 * Couleur de chaque type d'annonce (hex) : marqueurs Leaflet, pastille de la lettre
 * (TypeBadge) et pastille d'icône des cartes (CategoryTile).
 * 2026-10-07 : couleurs système d'Apple, dans leur version contrastée (celle
 * d'« Augmenter le contraste ») pour qu'une lettre blanche reste lisible : contraste
 * ≥ 4,5:1 pour chacune. Le vert reste celui des actions et des icônes : aucun
 * type n'est vert. La lettre accompagne toujours la couleur.
 */
export const LISTING_TYPE_MARKER_COLORS: Record<ListingType, string> = {
  pret: '#0a64d8',    // bleu
  don: '#c2185b',     // rose framboise
  echange: '#8944ab', // violet
  service: '#b35c00', // orange
  vente: '#d70015',   // rouge
}

export const BOOK_CONDITION_LABELS: Record<BookCondition, string> = {
  neuf: 'Neuf',
  tres_bon: 'Très bon état',
  bon: 'Bon état',
  acceptable: 'État acceptable',
  abime: 'Abîmé',
}

/** Genres proposés pour une annonce de la catégorie "Livres" */
export const BOOK_GENRES = [
  'Roman',
  'Policier / Thriller',
  'Science-fiction / Fantasy',
  'Jeunesse',
  'Bande dessinée / Manga',
  'Biographie / Récit',
  'Histoire',
  'Sciences / Technique',
  'Développement personnel',
  'Cuisine',
  'Art / Beau livre',
  'Scolaire / Études',
  'Autre',
] as const

// ─── Documents du lotissement (migration 040) ────────────────────────────────

/** Nature d'un fichier rattaché à une assemblée générale */
export type AssemblyDocumentKind = 'agenda' | 'presentation' | 'minutes'

export const ASSEMBLY_DOCUMENT_KIND_LABELS: Record<AssemblyDocumentKind, string> = {
  agenda: 'Ordre du jour',
  presentation: 'Présentation',
  minutes: 'Procès-verbal',
}

/** Ordre d'affichage des fichiers dans une assemblée */
export const ASSEMBLY_DOCUMENT_KINDS: AssemblyDocumentKind[] = ['agenda', 'presentation', 'minutes']

/**
 * Fichier d'une assemblée. `file_*` est le PDF lu par la visionneuse ;
 * `source_*` est le PowerPoint d'origine (présentation uniquement, téléchargement seul).
 */
export interface AssemblyDocument {
  id: string
  assembly_id: string
  kind: AssemblyDocumentKind
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  page_count: number | null
  source_path: string | null
  source_name: string | null
  source_size: number | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

/** Assemblée générale du lotissement : ordre du jour + présentation + PV */
export interface Assembly {
  id: string
  title: string
  /** Date de tenue au format `YYYY-MM-DD` (colonne `date`) */
  held_on: string
  created_by: string | null
  created_at: string
  updated_at: string
  // Join
  assembly_documents?: AssemblyDocument[]
}

// ─── Documents permanents de l'ASL (migration 041) ───────────────────────────

/** Nature d'un document permanent, indépendant des assemblées */
export type AslDocumentKind = 'statuts' | 'reglement' | 'autre'

export const ASL_DOCUMENT_KIND_LABELS: Record<AslDocumentKind, string> = {
  statuts: "Statuts de l'ASL",
  reglement: 'Règlement intérieur',
  autre: 'Autre document',
}

/** Emplacements proposés sur la page Documents ASL (un fichier de chaque) */
export const ASL_DOCUMENT_KINDS: AslDocumentKind[] = ['statuts']

/** Document permanent de l'ASL : un seul par nature, remplacé au fil des mises à jour */
export interface AslDocument {
  id: string
  kind: AslDocumentKind
  title: string
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  page_count: number | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}
