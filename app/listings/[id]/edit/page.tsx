'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import type { ListingType, Category } from '@/lib/types'
import AddressAutocomplete, { type ResolvedAddress } from '@/components/forms/AddressAutocomplete'

const LISTING_TYPES: { value: ListingType; label: string; icon: string }[] = [
  { value: 'pret', label: 'Prêt', icon: '🔄' },
  { value: 'don', label: 'Don', icon: '🎁' },
  { value: 'echange', label: 'Échange', icon: '🤝' },
  { value: 'service', label: 'Service', icon: '⚡' },
]

export default function EditListingPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'pret' as ListingType,
    category_id: '',
    address: '',
    city: '',
  })

  // Location: null = keep existing, coords = update to new
  const [newLocation, setNewLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [hasExistingLocation, setHasExistingLocation] = useState(false)
  // Address text to pre-fill in locked state (built from listing.address + listing.city)
  const [existingAddressText, setExistingAddressText] = useState<string | undefined>(undefined)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => {
      if (data) setCategories(data)
    })
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/listings/${id}/edit`)}`)
        return
      }

      const { data: listing, error: fetchError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !listing) { setNotFound(true); setLoading(false); return }
      if (listing.user_id !== user.id) { setUnauthorized(true); setLoading(false); return }

      setForm({
        title: listing.title || '',
        description: listing.description || '',
        type: listing.type || 'pret',
        category_id: listing.category_id ? String(listing.category_id) : '',
        address: listing.address || '',
        city: listing.city || '',
      })
      setExistingImageUrl(listing.image_url || null)
      setImagePreview(listing.image_url || null)

      // Reconstruit le texte d'adresse affiché dans le composant verrouillé
      const addressParts = [listing.address, listing.city].filter(Boolean)
      if (addressParts.length > 0) {
        setExistingAddressText(addressParts.join(', '))
        setHasExistingLocation(true)
      }
      setLoading(false)
    }
    init()
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleAddressSelect = (resolved: ResolvedAddress) => {
    setNewLocation({ lat: resolved.lat, lng: resolved.lon })
    setHasExistingLocation(false)
    setForm(f => ({ ...f, address: resolved.road, city: resolved.city }))
  }

  const handleAddressClear = () => {
    setNewLocation(null)
    setHasExistingLocation(false)
    setForm(f => ({ ...f, address: '', city: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasExistingLocation && !newLocation) {
      return setError('Veuillez sélectionner une adresse valide.')
    }
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/listings/${id}/edit`)}`)
      return
    }

    let image_url = existingImageUrl

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('listings').upload(path, imageFile)
      if (!uploadErr) {
        const { data } = supabase.storage.from('listings').getPublicUrl(path)
        image_url = data.publicUrl
      }
    }

    const updates: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      type: form.type,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      address: form.address,
      city: form.city,
      image_url,
      updated_at: new Date().toISOString(),
    }

    // Only update location if user explicitly re-detected
    if (newLocation) {
      updates.location = `POINT(${newLocation.lng} ${newLocation.lat})`
    }

    const { error: updateErr } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateErr) {
      setError('Erreur lors de la mise à jour. Réessayez.')
      setSaving(false)
    } else {
      router.push('/profile')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
        <p className="text-lg font-medium mb-4">Annonce introuvable</p>
        <Link href="/profile" className="text-brand-600 hover:underline text-sm">← Retour au profil</Link>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
        <p className="text-lg font-medium mb-4">Vous n&apos;êtes pas autorisé à modifier cette annonce</p>
        <Link href="/profile" className="text-brand-600 hover:underline text-sm">← Retour au profil</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Retour au profil
      </Link>

      <h1 className="text-2xl font-bold mb-1">Modifier l&apos;annonce</h1>
      <p className="text-gray-500 mb-8 text-sm">Mettez à jour les informations de votre annonce.</p>

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

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Photo</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
          {imagePreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Preview" className="w-full max-h-72 object-contain rounded-xl bg-gray-100" />
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setExistingImageUrl(null) }}
                className="absolute top-2 right-2 bg-white rounded-full px-3 py-1 text-xs font-medium shadow hover:bg-gray-50">
                Supprimer
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="absolute bottom-2 right-2 bg-white rounded-full px-3 py-1 text-xs font-medium shadow hover:bg-gray-50">
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

        {/* Adresse */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Adresse <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Tapez une adresse et sélectionnez-la dans la liste, ou utilisez votre position actuelle.
          </p>
          <AddressAutocomplete
            lockedValue={existingAddressText}
            onSelect={handleAddressSelect}
            onClear={handleAddressClear}
            placeholder="Ex : 12 rue de la Paix, Paris"
          />
        </div>

        <button type="submit" disabled={saving || (!hasExistingLocation && !newLocation)}
          className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={18} className="animate-spin" /> Enregistrement...</> : 'Enregistrer les modifications'}
        </button>
      </form>
    </div>
  )
}
