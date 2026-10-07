'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { FormHeader } from '@/components/layout/FormHeader'
import type { Listing } from '@/lib/types'
import { ListingForm } from '@/components/listings/ListingForm'

export default function EditListingPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/listings/${id}/edit`)}`)
        return
      }

      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single()

      if (cancelled) return

      if (error || !data) { setNotFound(true); setLoading(false); return }
      if (data.user_id !== user.id) { setUnauthorized(true); setLoading(false); return }

      setListing(data as Listing)
      setLoading(false)
    }

    init()
    return () => { cancelled = true }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="max-w-2xl mx-auto px-4 pb-8">
      {/* « Annuler » ramène à l'annonce, sans rien enregistrer */}
      <FormHeader title="Modifier l'annonce" cancelHref={`/listings/${id}`} />
      <p className="text-gray-500 mb-8 text-sm">Mettez à jour les informations de votre annonce.</p>

      <ListingForm mode="edit" listingId={id} initial={listing} />
    </div>
  )
}
