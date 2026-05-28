'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AddressAutocomplete, { type ResolvedAddress } from '@/components/forms/AddressAutocomplete'
import { Upload, X, Loader2, CalendarDays, MapPin, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_PHOTOS = 3

export default function EventForm() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    event_date: '',
    event_end_date: '',
    location_text: '',
  })
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleAddressSelect = (resolved: ResolvedAddress) => {
    setLocation({ lat: resolved.lat, lng: resolved.lon })
    setForm(f => ({ ...f, location_text: resolved.displayName }))
  }

  const handleAddressClear = () => {
    setLocation(null)
    setForm(f => ({ ...f, location_text: '' }))
  }

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_PHOTOS - imageFiles.length
    const toAdd = files.slice(0, remaining)
    setImageFiles(prev => [...prev, ...toAdd])
    setImagePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Veuillez saisir un titre.')
    if (!form.event_date) return setError('Veuillez saisir une date et heure.')
    if (form.event_end_date && form.event_end_date <= form.event_date) {
      return setError('La date de fin doit être après la date de début.')
    }

    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login?redirect=%2Fevenements%2Fnew')
      return
    }

    // Upload images
    const imageUrls: string[] = []
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}_${i}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('events').upload(path, file)
      if (!uploadErr) {
        const { data } = supabase.storage.from('events').getPublicUrl(path)
        imageUrls.push(data.publicUrl)
      }
    }

    const { error: insertErr } = await supabase.from('events').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: new Date(form.event_date).toISOString(),
      event_end_date: form.event_end_date ? new Date(form.event_end_date).toISOString() : null,
      location_text: form.location_text || null,
      location_lat: location?.lat ?? null,
      location_lng: location?.lng ?? null,
      image_urls: imageUrls,
    })

    if (insertErr) {
      setError(insertErr.message)
      setLoading(false)
      return
    }

    router.push('/evenements')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Créer un événement</h1>
        <p className="text-sm text-gray-500">Partagez un événement avec vos voisins du Cèdre.</p>
      </div>

      {/* Titre */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Titre *</label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Ex : Vide-grenier, Barbecue de quartier…"
          required
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={4}
          placeholder="Décrivez votre événement, ce qu'il faut apporter, etc."
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
        />
      </div>

      {/* Date & heure */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <CalendarDays size={14} /> Date et heure de début *
          </label>
          <input
            type="datetime-local"
            name="event_date"
            value={form.event_date}
            onChange={handleChange}
            required
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <CalendarDays size={14} /> Date et heure de fin
          </label>
          <input
            type="datetime-local"
            name="event_end_date"
            value={form.event_end_date}
            onChange={handleChange}
            min={form.event_date || undefined}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
      </div>

      {/* Lieu */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <MapPin size={14} /> Lieu
        </label>
        <AddressAutocomplete
          onSelect={handleAddressSelect}
          onClear={handleAddressClear}
          lockedValue={form.location_text || undefined}
          placeholder="Chercher une adresse…"
        />
      </div>

      {/* Photos */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <ImageIcon size={14} /> Photos ({imageFiles.length}/{MAX_PHOTOS})
        </label>

        {imagePreviews.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow border border-gray-200"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {imageFiles.length < MAX_PHOTOS && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImages}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              <Upload size={16} /> Ajouter des photos
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2',
            loading ? 'bg-brand-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'
          )}
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Publication…</> : 'Publier l\'événement'}
        </button>
      </div>
    </form>
  )
}
