'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/lib/types'
import { ListingCard } from '@/components/listings/ListingCard'
import { FilterBar } from '@/components/map/FilterBar'
import { MapPin, Loader2, X } from 'lucide-react'
import { formatDistance } from '@/lib/utils'

// Dynamic import pour éviter SSR avec Leaflet
const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <Loader2 className="animate-spin text-brand-600" size={32} />
    </div>
  ),
})

export function MapView() {
  const searchParams = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const [selected, setSelected] = useState<Listing | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [radius, setRadius] = useState(5)
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Géolocalisation
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => setUserLocation([48.8566, 2.3522]) // Paris par défaut
    )
  }, [])

  // Fetch annonces
  const fetchListings = useCallback(async () => {
    if (!userLocation) return
    setLoading(true)
    const [lat, lng] = userLocation

    const { data, error } = await supabase.rpc('listings_within_radius', {
      lat, lng, radius_km: radius,
    })

    if (!error && data) {
      let filtered = data as Listing[]
      if (category) filtered = filtered.filter(l => {
        // Filter par slug catégorie via join si disponible
        return true // simplifié — à affiner avec un join sur categories
      })
      setListings(filtered)
    }
    setLoading(false)
  }, [userLocation, radius, category])

  useEffect(() => { fetchListings() }, [fetchListings])

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-full md:w-96 flex flex-col bg-white border-r border-gray-200 overflow-hidden z-10">
        <FilterBar
          radius={radius}
          onRadiusChange={setRadius}
          category={category}
          onCategoryChange={setCategory}
          count={listings.length}
          loading={loading}
        />

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-brand-600" size={28} />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MapPin size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune annonce dans ce rayon</p>
              <p className="text-sm mt-1">Essayez d&apos;augmenter le rayon de recherche</p>
            </div>
          ) : (
            listings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                compact
                onClick={() => setSelected(listing)}
                active={selected?.id === listing.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative hidden md:block">
        {userLocation && (
          <LeafletMap
            center={userLocation}
            listings={listings}
            onSelectListing={setSelected}
            selectedId={selected?.id}
          />
        )}

        {/* Popup détail sélectionné */}
        {selected && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-80 z-[1000]">
            <div className="relative">
              <button onClick={() => setSelected(null)}
                className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-gray-200 z-10">
                <X size={14} />
              </button>
              <ListingCard listing={selected} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
