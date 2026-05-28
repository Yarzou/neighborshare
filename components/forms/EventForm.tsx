'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AddressAutocomplete, { type ResolvedAddress } from '@/components/forms/AddressAutocomplete'
import { Upload, X, Loader2, CalendarDays, MapPin, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Event } from '@/lib/types'

const MAX_PHOTOS = 3

interface EventFormProps {
  /** Si fourni, le formulaire est en mode édition */
  initialEvent?: Event
}

// Format ISO → datetime-local input value (YYYY-MM-DDTHH:MM)
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export default function EventForm({ initialEvent }: EventFormProps) {
  const isEdit = !!initialEvent
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: initialEvent?.title ?? '',
    description: initialEvent?.description ?? '',
    event_date: toDatetimeLocal(initialEvent?.event_date),
    event_end_date: toDatetimeLocal(initialEvent?.event_end_date),
    location_text: initialEvent?.location_text ?? '',
  })
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    initialEvent?.location_lat && initialEvent?.location_lng
      ? { lat: initialEvent.location_lat, lng: initialEvent.location_lng }
      : null
  )

  // Existing images (already uploaded) — can be removed
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(
    initialEvent?.image_urls ?? []
  )
  // New images to upload
  const [newImageFiles, setNewImageFiles] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])
  // Images to delete from storage on save
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalImages = existingImageUrls.length + newImageFiles.length

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

  const removeExistingImage = (url: string) => {
    setExistingImageUrls(prev => prev.filter(u => u !== url))
    setImagesToDelete(prev => [...prev, url])
  }

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_PHOTOS - totalImages
    const toAdd = files.slice(0, remaining)
    setNewImageFiles(prev => [...prev, ...toAdd])
    setNewImagePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removeNewImage = (index: number) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index))
    setNewImagePreviews(prev => {
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
      router.push('/auth/login')
      return
    }

    // Delete removed images from storage
    for (const url of imagesToDelete) {
      const path = url.split('/storage/v1/object/public/events/')[1]
      if (path) await supabase.storage.from('events').remove([path])
    }

    // Upload new images
    const newUrls: string[] = []
    for (let i = 0; i < newImageFiles.length; i++) {
      const file = newImageFiles[i]
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}_${i}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('events').upload(path, file)
      if (!uploadErr) {
        const { data } = supabase.storage.from('events').getPublicUrl(path)
        newUrls.push(data.publicUrl)
      }
    }

    const imageUrls = [...existingImageUrls, ...newUrls]
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: new Date(form.event_date).toISOString(),
      event_end_date: form.event_end_date ? new Date(form.event_end_date).toISOString() : null,
      location_text: form.location_text || null,
      location_lat: location?.lat ?? null,
      location_lng: location?.lng ?? null,
      image_urls: imageUrls,
    }

    let dbError
    if (isEdit) {
      const { error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', initialEvent!.id)
        .eq('user_id', user.id)
      dbError = error
    } else {
      const { error } = await supabase.from('events').insert({ user_id: user.id, ...payload })
      dbError = error
    }

    if (dbError) {
      setError(dbError.message)
      setLoading(false)
      return
    }

    router.push('/profile')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {isEdit ? 'Modifier l\'événement' : 'Créer un événement'}
        </h1>
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
          <ImageIcon size={14} /> Photos ({totalImages}/{MAX_PHOTOS})
        </label>

        {/* Existing images */}
        {existingImageUrls.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {existingImageUrls.map((url, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(url)}
                  className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow border border-gray-200"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New image previews */}
        {newImagePreviews.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {newImagePreviews.map((src, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-dashed border-brand-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewImage(i)}
                  className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow border border-gray-200"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {totalImages < MAX_PHOTOS && (
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
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> {isEdit ? 'Enregistrement…' : 'Publication…'}</>
            : isEdit ? 'Enregistrer les modifications' : 'Publier l\'événement'
          }
        </button>
      </div>
    </form>
  )
}