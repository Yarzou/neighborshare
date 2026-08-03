'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { ListingForm, type ListingFormDefaultAddress } from '@/components/listings/ListingForm'

export default function NewListingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [defaultAddress, setDefaultAddress] = useState<ListingFormDefaultAddress | null>(null)
  const [profileHadAddress, setProfileHadAddress] = useState(false)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth/login?redirect=${encodeURIComponent('/listings/new')}`)
        return
      }

      // Pré-remplit l'adresse depuis le profil si elle y est déjà connue
      const { data: prof } = await supabase
        .from('profiles')
        .select('address_display, address_road, address_city, address_lat, address_lng')
        .eq('id', user.id)
        .single()

      if (cancelled) return

      if (prof?.address_lat && prof?.address_lng && prof?.address_display) {
        setDefaultAddress({
          display: prof.address_display,
          road: prof.address_road || prof.address_display,
          city: prof.address_city || '',
          lat: prof.address_lat,
          lng: prof.address_lng,
        })
        setProfileHadAddress(true)
      }
      setReady(true)
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Publier une annonce</h1>
      <p className="text-gray-500 mb-8">Partagez un objet, un service ou une compétence avec vos voisins.</p>

      <ListingForm
        mode="create"
        defaultAddress={defaultAddress}
        profileHadAddress={profileHadAddress}
      />
    </div>
  )
}
