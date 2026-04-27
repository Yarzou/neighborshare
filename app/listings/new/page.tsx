'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, AlertCircle, CalendarDays, Plus, X } from 'lucide-react'
import type { ListingType, Category, ChildcareMode, ChildcareSlot, ListingIntent } from '@/lib/types'
import { VENTE_EXCLUDED_SLUGS } from '@/lib/categories'
import AddressAutocomplete, { type ResolvedAddress } from '@/components/forms/AddressAutocomplete'

const CarpoolMiniMap = dynamic(() => import('@/components/map/CarpoolMiniMap'), { ssr: false })

const LISTING_TYPES: { value: ListingType; label: string; icon: string }[] = [
  { value: 'pret', label: 'Prêt', icon: '🔄' },
  { value: 'don', label: 'Don', icon: '🎁' },
  { value: 'echange', label: 'Échange', icon: '🤝' },
  { value: 'service', label: 'Service', icon: '⚡' },
  { value: 'vente', label: 'Vendre', icon: '💰' },
]

const CARPOOL_SLUG = 'covoiturage'
const CHILDCARE_SLUG = 'garde-enfant'

export default function NewListingPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    title: '', description: '', type: 'pret' as ListingType,
    category_id: '', address: '', city: '', price: '',
  })
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Carpool fields
  const [carpoolDeparture, setCarpoolDeparture] = useState<ResolvedAddress | null>(null)
  const [carpoolArrival, setCarpoolArrival] = useState<ResolvedAddress | null>(null)

  // Childcare fields
  const [childcareStart, setChildcareStart] = useState('')
  const [childcareEnd, setChildcareEnd] = useState('')
  const [childcareMode, setChildcareMode] = useState<ChildcareMode>('demande')
  const [childcareSlots, setChildcareSlots] = useState<ChildcareSlot[]>([])

  // Recurring slot builder state
  const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const
  const [recurringDays, setRecurringDays] = useState<Set<number>>(new Set())
  const [recurringStart, setRecurringStart] = useState('09:00')
  const [recurringEnd, setRecurringEnd] = useState('17:00')

  // Once slot builder state
  const [onceDate, setOnceDate] = useState('')
  const [onceStart, setOnceStart] = useState('09:00')
  const [onceEnd, setOnceEnd] = useState('17:00')

  // Global intent + expiry
  const [listingIntent, setListingIntent] = useState<ListingIntent>('offre')
  const [expiresAt, setExpiresAt] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const selectedCategory = categories.find(c => String(c.id) === form.category_id)
  const isCarpool = selectedCategory?.slug === CARPOOL_SLUG
  const isChildcare = selectedCategory?.slug === CHILDCARE_SLUG
  const hidePhoto = isCarpool || isChildcare

  // Quand le type est "vente", covoiturage et garde d'enfant ne sont pas pertinents
  const filteredCategories = form.type === 'vente'
    ? categories.filter(c => !VENTE_EXCLUDED_SLUGS.includes(c.slug as typeof VENTE_EXCLUDED_SLUGS[number]))
    : categories

  // Réinitialise la catégorie si elle est incompatible avec le type sélectionné
  useEffect(() => {
    if (form.type === 'vente' && selectedCategory && VENTE_EXCLUDED_SLUGS.includes(selectedCategory.slug as typeof VENTE_EXCLUDED_SLUGS[number])) {
      setForm(f => ({ ...f, category_id: '' }))
    }
  }, [form.type])

  // S'assure que la session est bien chargée côté client avant d'autoriser la publication.
  // Sans ça, supabase.auth.getUser() peut rendre null juste après un login/redirect.
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
        const sessionUserId = currentUser?.id ?? null
        if (!cancelled) setUserId(sessionUserId)

        // Se re-synchronise avec l'état auth au fil du temps.
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return
          setUserId(session?.user?.id ?? null)
        })

        if (!cancelled) setAuthReady(true)

        return () => subscription.unsubscribe()
      } catch {
        if (!cancelled) setAuthReady(true)
      }
    }

    const cleanupPromise = init()
    return () => {
      cancelled = true
      void cleanupPromise
    }
  }, [supabase])

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => {
      if (data) setCategories(data)
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleAddressSelect = (resolved: ResolvedAddress) => {
    setLocation({ lat: resolved.lat, lng: resolved.lon })
    setForm(f => ({ ...f, address: resolved.road, city: resolved.city }))
  }

  const handleAddressClear = () => {
    setLocation(null)
    setForm(f => ({ ...f, address: '', city: '' }))
  }

  const toggleRecurringDay = (day: number) => {
    setRecurringDays(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  const addRecurringSlots = () => {
    if (recurringDays.size === 0 || !recurringStart || !recurringEnd) return
    const newSlots: ChildcareSlot[] = Array.from(recurringDays).map(day => ({
      type: 'recurring', day: day as 0|1|2|3|4|5|6, start_time: recurringStart, end_time: recurringEnd,
    }))
    setChildcareSlots(prev => [...prev, ...newSlots])
    setRecurringDays(new Set())
  }

  const addOnceSlot = () => {
    if (!onceDate || !onceStart || !onceEnd) return
    setChildcareSlots(prev => [...prev, { type: 'once', date: onceDate, start_time: onceStart, end_time: onceEnd }])
    setOnceDate('')
  }

  const removeSlot = (index: number) => {
    setChildcareSlots(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isCarpool && (!carpoolDeparture || !carpoolArrival)) {
      return setError('Veuillez renseigner les adresses de départ et d\'arrivée.')
    }
    if (isChildcare && childcareMode === 'demande' && (!childcareStart || !childcareEnd)) {
      return setError('Veuillez renseigner les dates et heures de la garde.')
    }
    if (isChildcare && childcareMode === 'demande' && childcareEnd <= childcareStart) {
      return setError('La date de fin doit être après la date de début.')
    }
    if (isChildcare && childcareMode === 'offre' && childcareSlots.length === 0) {
      return setError('Veuillez ajouter au moins un créneau de disponibilité.')
    }
    if (!isCarpool && !location) return setError('Veuillez sélectionner une adresse.')
    setLoading(true)
    setError(null)

    if (!authReady) {
      setError('Chargement de votre session... réessayez dans un instant.')
      setLoading(false)
      return
    }

    // Préfère la session si dispo (plus fiable juste après redirect).
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return router.push(`/auth/login?redirect=${encodeURIComponent('/listings/new')}`)
    }

    let image_url = null

    // Upload image (seulement si ni covoiturage ni garde d'enfant)
    if (!hidePhoto && imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('listings').upload(path, imageFile)
      if (!uploadErr) {
        const { data } = supabase.storage.from('listings').getPublicUrl(path)
        image_url = data.publicUrl
      }
    }

    // Détermine le point de localisation
    let locationPoint: string | null = null
    if (isCarpool) {
      locationPoint = `POINT(${carpoolDeparture!.lon} ${carpoolDeparture!.lat})`
    } else if (location) {
      locationPoint = `POINT(${location.lng} ${location.lat})`
    }

    // Insert listing
    const { data, error: insertErr } = await supabase.from('listings').insert({
      user_id: user.id,
      title: form.title,
      description: form.description,
      type: form.type,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      address: isCarpool ? carpoolDeparture?.road ?? '' : form.address,
      city: isCarpool ? carpoolDeparture?.city ?? '' : form.city,
      image_url,
      location: locationPoint,
      carpool_departure_address: isCarpool ? carpoolDeparture?.displayName ?? null : null,
      carpool_departure_lat: isCarpool ? carpoolDeparture?.lat ?? null : null,
      carpool_departure_lng: isCarpool ? carpoolDeparture?.lon ?? null : null,
      carpool_arrival_address: isCarpool ? carpoolArrival?.displayName ?? null : null,
      carpool_arrival_lat: isCarpool ? carpoolArrival?.lat ?? null : null,
      carpool_arrival_lng: isCarpool ? carpoolArrival?.lon ?? null : null,
      childcare_start_at: isChildcare && childcareMode === 'demande' ? childcareStart || null : null,
      childcare_end_at: isChildcare && childcareMode === 'demande' ? childcareEnd || null : null,
      childcare_mode: isChildcare ? childcareMode : null,
      childcare_slots: isChildcare && childcareMode === 'offre' ? childcareSlots : null,
      listing_intent: listingIntent,
      expires_at: expiresAt || null,
      price: form.type === 'vente' && form.price ? parseFloat(form.price) : null,
    }).select().single()

    if (insertErr) {
      setError('Erreur lors de la publication. Réessayez.')
      setLoading(false)
    } else {
      router.push(`/listings/${data.id}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Publier une annonce</h1>
      <p className="text-gray-500 mb-8">Partagez un objet, un service ou une compétence avec vos voisins.</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Intent : offre / demande */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Je souhaite…</label>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            <button type="button" onClick={() => setListingIntent('offre')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${listingIntent === 'offre' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              🎁 Proposer quelque chose
            </button>
            <button type="button" onClick={() => setListingIntent('demande')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${listingIntent === 'demande' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              🔍 Chercher quelque chose
            </button>
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type d&apos;annonce</label>
          <div className="grid grid-cols-5 gap-2">
            {LISTING_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value }))}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  form.type === t.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="text-xl">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prix — affiché uniquement pour les ventes */}
        {form.type === 'vente' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix (€) *</label>
            <div className="relative">
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
                placeholder="Ex: 25.00"
                className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">€</span>
            </div>
          </div>
        )}

        {/* Titre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre *</label>
          <input name="title" value={form.title} onChange={handleChange} required
            placeholder="Ex: Perceuse Bosch à prêter le week-end"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={3}
            placeholder="Décrivez votre annonce en détail..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-none" />
        </div>

        {/* Catégorie */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
          <select name="category_id" value={form.category_id} onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white">
            <option value="">Choisir une catégorie...</option>
            {filteredCategories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Photo — masquée pour covoiturage et garde d'enfant */}
        {!hidePhoto && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Photo</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full max-h-72 object-contain rounded-xl bg-gray-100" />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="absolute top-2 right-2 bg-white rounded-full px-3 py-1 text-xs font-medium shadow hover:bg-gray-50">
                  Changer
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors">
                <Upload size={24} />
                <span className="text-sm">Cliquez pour ajouter une photo</span>
              </button>
            )}
          </div>
        )}

        {/* Champs covoiturage */}
        {isCarpool && (
          <div className="flex flex-col gap-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
            <p className="text-sm font-semibold text-indigo-700">🚗 Trajet covoiturage</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Adresse de départ <span className="text-red-500">*</span>
              </label>
              <AddressAutocomplete
                onSelect={r => setCarpoolDeparture(r)}
                onClear={() => setCarpoolDeparture(null)}
                placeholder="Ex : 12 rue de la Paix, Paris"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Adresse d&apos;arrivée <span className="text-red-500">*</span>
              </label>
              <AddressAutocomplete
                onSelect={r => setCarpoolArrival(r)}
                onClear={() => setCarpoolArrival(null)}
                placeholder="Ex : Place Bellecour, Lyon"
              />
            </div>

            {carpoolDeparture && carpoolArrival && (
              <div className="rounded-xl overflow-hidden border border-indigo-200">
                <CarpoolMiniMap
                  departureLat={carpoolDeparture.lat}
                  departureLng={carpoolDeparture.lon}
                  departureLabel={carpoolDeparture.displayName}
                  arrivalLat={carpoolArrival.lat}
                  arrivalLng={carpoolArrival.lon}
                  arrivalLabel={carpoolArrival.displayName}
                  className="w-full h-48"
                />
              </div>
            )}
          </div>
        )}

        {/* Champs garde d'enfant */}
        {isChildcare && (
          <div className="flex flex-col gap-4 p-4 rounded-2xl bg-violet-50 border border-violet-100">
            <p className="text-sm font-semibold text-violet-700 flex items-center gap-2">
              <CalendarDays size={16} /> Garde d&apos;enfant
            </p>

            {/* Toggle demande / offre */}
            <div className="flex rounded-xl overflow-hidden border border-violet-200 bg-white">
              <button type="button" onClick={() => setChildcareMode('demande')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${childcareMode === 'demande' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-violet-50'}`}>
                🙋 Je cherche une garde
              </button>
              <button type="button" onClick={() => setChildcareMode('offre')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${childcareMode === 'offre' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-violet-50'}`}>
                📅 Je propose des disponibilités
              </button>
            </div>

            {/* Mode demande : champs début / fin */}
            {childcareMode === 'demande' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Début <span className="text-red-500">*</span>
                  </label>
                  <input type="datetime-local" value={childcareStart}
                    onChange={e => setChildcareStart(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Fin <span className="text-red-500">*</span>
                  </label>
                  <input type="datetime-local" value={childcareEnd} min={childcareStart || undefined}
                    onChange={e => setChildcareEnd(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm bg-white" />
                </div>
              </div>
            )}

            {/* Mode offre : builder de créneaux */}
            {childcareMode === 'offre' && (
              <div className="flex flex-col gap-4">

                {/* Récurrents */}
                <div className="bg-white rounded-xl border border-violet-100 p-3 flex flex-col gap-3">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Créneaux récurrents</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((label, day) => (
                      <button key={day} type="button" onClick={() => toggleRecurringDay(day)}
                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                          recurringDays.has(day) ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600 hover:border-violet-300'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" value={recurringStart} onChange={e => setRecurringStart(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                    <span className="text-gray-400 text-sm">→</span>
                    <input type="time" value={recurringEnd} onChange={e => setRecurringEnd(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                    <button type="button" onClick={addRecurringSlots} disabled={recurringDays.size === 0}
                      className="flex items-center gap-1 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                </div>

                {/* Ponctuels */}
                <div className="bg-white rounded-xl border border-violet-100 p-3 flex flex-col gap-3">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Créneau ponctuel</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" value={onceDate} onChange={e => setOnceDate(e.target.value)}
                      className="flex-1 min-w-[130px] px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                    <input type="time" value={onceStart} onChange={e => setOnceStart(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                    <span className="text-gray-400 text-sm">→</span>
                    <input type="time" value={onceEnd} onChange={e => setOnceEnd(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                    <button type="button" onClick={addOnceSlot} disabled={!onceDate}
                      className="flex items-center gap-1 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                </div>

                {/* Liste des créneaux ajoutés */}
                {childcareSlots.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Créneaux ajoutés</p>
                    {childcareSlots.map((slot, i) => (
                      <div key={i} className="flex items-center justify-between bg-violet-100 rounded-xl px-3 py-2 text-sm text-violet-800">
                        <span>
                          {slot.type === 'recurring'
                            ? `🔁 ${DAYS[slot.day]} — ${slot.start_time.replace(':', 'h')} → ${slot.end_time.replace(':', 'h')}`
                            : `📅 ${new Date(slot.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — ${slot.start_time.replace(':', 'h')} → ${slot.end_time.replace(':', 'h')}`
                          }
                        </span>
                        <button type="button" onClick={() => removeSlot(i)}
                          className="ml-2 text-violet-400 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Adresse — masquée uniquement pour covoiturage (coords du départ utilisées à la place) */}
        {!isCarpool && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Adresse <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Tapez une adresse et sélectionnez-la dans la liste, ou utilisez votre position actuelle.
            </p>
            <AddressAutocomplete
              onSelect={handleAddressSelect}
              onClear={handleAddressClear}
              placeholder="Ex : 12 rue de la Paix, Paris"
            />
          </div>
        )}

        {/* Expiration optionnelle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Date d&apos;expiration <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">L&apos;annonce disparaîtra automatiquement de la carte après cette date.</p>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white" />
        </div>

        <button type="submit" disabled={loading || (!isCarpool && !location)}
          className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Publication...</> : 'Publier l\'annonce'}
        </button>
      </form>
    </div>
  )
}
