'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, AlertCircle, CalendarDays } from 'lucide-react'
import type { ListingType, Category } from '@/lib/types'
import AddressAutocomplete, { type ResolvedAddress } from '@/components/forms/AddressAutocomplete'

const CarpoolMiniMap = dynamic(() => import('@/components/map/CarpoolMiniMap'), { ssr: false })

const LISTING_TYPES: { value: ListingType; label: string; icon: string }[] = [
  { value: 'pret', label: 'Prêt', icon: '🔄' },
  { value: 'don', label: 'Don', icon: '🎁' },
  { value: 'echange', label: 'Échange', icon: '🤝' },
  { value: 'service', label: 'Service', icon: '⚡' },
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
    category_id: '', address: '', city: '',
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

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const selectedCategory = categories.find(c => String(c.id) === form.category_id)
  const isCarpool = selectedCategory?.slug === CARPOOL_SLUG
  const isChildcare = selectedCategory?.slug === CHILDCARE_SLUG
  const hidePhoto = isCarpool || isChildcare

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isCarpool && (!carpoolDeparture || !carpoolArrival)) {
      return setError('Veuillez renseigner les adresses de départ et d\'arrivée.')
    }
    if (isChildcare && (!childcareStart || !childcareEnd)) {
      return setError('Veuillez renseigner les dates et heures de la garde.')
    }
    if (isChildcare && childcareEnd <= childcareStart) {
      return setError('La date de fin doit être après la date de début.')
    }
    if (!isCarpool && !isChildcare && !location) return setError('Veuillez sélectionner une adresse.')
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
    let locationPoint: string
    if (isCarpool) {
      locationPoint = `POINT(${carpoolDeparture!.lon} ${carpoolDeparture!.lat})`
    } else {
      locationPoint = `POINT(${location!.lng} ${location!.lat})`
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
      childcare_start_at: isChildcare ? childcareStart || null : null,
      childcare_end_at: isChildcare ? childcareEnd || null : null,
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
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type d&apos;annonce</label>
          <div className="grid grid-cols-4 gap-2">
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
            {categories.map(c => (
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
              <CalendarDays size={16} /> Période de garde
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Début <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={childcareStart}
                  onChange={e => setChildcareStart(e.target.value)}
                  required={isChildcare}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={childcareEnd}
                  min={childcareStart || undefined}
                  onChange={e => setChildcareEnd(e.target.value)}
                  required={isChildcare}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Adresse — masquée pour covoiturage (coords départ) et garde d'enfant */}
        {!isCarpool && !isChildcare && (
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

        <button type="submit" disabled={loading || (!isCarpool && !isChildcare && !location)}
          className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Publication...</> : 'Publier l\'annonce'}
        </button>
      </form>
    </div>
  )
}
