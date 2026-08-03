'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowLeft } from 'lucide-react'
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Retour au profil
      </Link>

      <h1 className="text-2xl font-bold mb-1">Modifier l&apos;annonce</h1>
      <p className="text-gray-500 mb-8 text-sm">Mettez à jour les informations de votre annonce.</p>

      <ListingForm mode="edit" listingId={id} initial={listing} />
    </div>
  )
}
