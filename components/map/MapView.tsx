'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/lib/types'
import { ListingCard } from '@/components/listings/ListingCard'
import { FilterBar } from '@/components/map/FilterBar'
import { MapPin, Loader2, X, Map, List } from 'lucide-react'
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

const NEIGHBORHOOD: [number, number] = [47.300837, -1.560131]

export function MapView() {
  const searchParams = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const [selected, setSelected] = useState<Listing | null>(null)
  // searchCenter: centre utilisé pour le rayon de recherche (La Chapelle par défaut)
  const [searchCenter, setSearchCenter] = useState<[number, number]>(NEIGHBORHOOD)
  // userGeoLocation: position GPS réelle (uniquement pour le marqueur bleu)
  const [userGeoLocation, setUserGeoLocation] = useState<[number, number] | null>(null)
  const [radius, setRadius] = useState(5)
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [loading, setLoading] = useState(true)
  const [searchedLocation, setSearchedLocation] = useState<[number, number] | null>(null)
  const [slugToId, setSlugToId] = useState<Record<string, number>>({})
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const supabase = createClient()

  // Charge le mapping slug → id une seule fois
  useEffect(() => {
    supabase.from('categories').select('id, slug').then(({ data }) => {
      if (data) {
        const map: Record<string, number> = {}
        data.forEach(c => { map[c.slug] = c.id })
        setSlugToId(map)
      }
    })
  }, [])

  // Géolocalisation — uniquement pour le marqueur "Vous êtes ici"
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserGeoLocation([pos.coords.latitude, pos.coords.longitude]),
    )
  }, [])

  // Fetch annonces
  const fetchListings = useCallback(async () => {
    setLoading(true)
    const [lat, lng] = searchCenter

    const { data, error } = await supabase.rpc('listings_within_radius', {
      lat, lng, radius_km: radius,
    })

    if (!error && data) {
      let filtered = data as Listing[]
      if (category) {
        const catId = slugToId[category]
        if (catId !== undefined) {
          filtered = filtered.filter(l => l.category_id === catId)
        }
      }
      setListings(filtered)
    }
    setLoading(false)
  }, [searchCenter, radius, category, slugToId])

  useEffect(() => { fetchListings() }, [fetchListings])

  const handleLocationSelect = (lat: number, lon: number) => {
    const coords: [number, number] = [lat, lon]
    setSearchCenter(coords)
    setSearchedLocation(coords)
  }

  return (
      <div className="flex flex-col h-full md:flex-row">
        {/* Toggle mobile */}
        <div className="md:hidden flex border-b border-gray-200 bg-white shrink-0">
          <button
              onClick={() => setMobileView('list')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                  mobileView === 'list'
                      ? 'text-brand-600 border-b-2 border-brand-600'
                      : 'text-gray-500'
              }`}
          >
            <List size={16} /> Liste
          </button>
          <button
              onClick={() => setMobileView('map')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                  mobileView === 'map'
                      ? 'text-brand-600 border-b-2 border-brand-600'
                      : 'text-gray-500'
              }`}
          >
            <Map size={16} /> Carte
          </button>
        </div>

        {/* Sidebar */}
        <div className={`w-full md:w-96 flex flex-col bg-white border-r border-gray-200 overflow-hidden z-10 ${mobileView === 'map' ? 'hidden md:flex' : 'flex'}`}>
          <FilterBar
              radius={radius}
              onRadiusChange={setRadius}
              category={category}
              onCategoryChange={setCategory}
              count={listings.length}
              loading={loading}
              onLocationSelect={handleLocationSelect}
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
        <div className={`flex-1 relative ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>
          <LeafletMap
              userPosition={userGeoLocation}
              listings={listings}
              onSelectListing={setSelected}
              selectedId={selected?.id}
              searchedLocation={searchedLocation}
              visible={mobileView === 'map'}
          />

          {/* Popup détail sélectionné */}
          {selected && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-80 z-[1000] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl shadow-xl">
                <div className="relative">
                  <button onClick={() => setSelected(null)}
                          className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md border border-gray-200 z-10">
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
