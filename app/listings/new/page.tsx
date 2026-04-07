'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Upload, Loader2, AlertCircle } from 'lucide-react'
import type { ListingType, Category } from '@/lib/types'

const LISTING_TYPES: { value: ListingType; label: string; icon: string }[] = [
  { value: 'pret', label: 'Prêt', icon: '🔄' },
  { value: 'don', label: 'Don', icon: '🎁' },
  { value: 'echange', label: 'Échange', icon: '🤝' },
  { value: 'service', label: 'Service', icon: '⚡' },
]

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locLoading, setLocLoading] = useState(false)

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

  const detectLocation = () => {
    setLocLoading(true)
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocLoading(false)
      },
      () => { setError('Impossible de détecter la position.'); setLocLoading(false) }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!location) return setError('Veuillez détecter votre position.')
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/auth/login')

    let image_url = null

    // Upload image
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('listings').upload(path, imageFile)
      if (!uploadErr) {
        const { data } = supabase.storage.from('listings').getPublicUrl(path)
        image_url = data.publicUrl
      }
    }

    // Insert listing
    const { data, error: insertErr } = await supabase.from('listings').insert({
      user_id: user.id,
      title: form.title,
      description: form.description,
      type: form.type,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      address: form.address,
      city: form.city,
      image_url,
      location: `POINT(${location.lng} ${location.lat})`,
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

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Photo</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
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

        {/* Adresse */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse (optionnel)</label>
            <input name="address" value={form.address} onChange={handleChange} placeholder="12 rue de la Paix"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville</label>
            <input name="city" value={form.city} onChange={handleChange} placeholder="Paris"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
          </div>
        </div>

        {/* Géolocalisation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Position *</label>
          <button type="button" onClick={detectLocation} disabled={locLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
              location ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 hover:border-brand-300'
            }`}>
            {locLoading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
            {location ? `Position détectée ✓ (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` : 'Utiliser ma position actuelle'}
          </button>
        </div>

        <button type="submit" disabled={loading || !location}
          className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Publication...</> : 'Publier l\'annonce'}
        </button>
      </form>
    </div>
  )
}
