'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/lib/types'
import { ListingCard } from '@/components/listings/ListingCard'
import { FilterBar } from '@/components/map/FilterBar'
import { LoginRequiredNotice } from '@/components/layout/LoginRequiredNotice'
import { MapPin, Loader2, X, Map, List, Plus, LayoutGrid } from 'lucide-react'
import { normalizeSearch, cn } from '@/lib/utils'
import { NEIGHBORHOOD_CENTER, NEIGHBORHOOD_RADIUS_KM, distanceMeters } from '@/lib/neighborhood'

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
  const router = useRouter()
  // rows = ce que la base a renvoyé, jamais filtré. `listings` en est dérivé
  // (useMemo plus bas) : catégorie et recherche ne déclenchent donc aucune requête.
  const [rows, setRows] = useState<Listing[]>([])
  const [selected, setSelected] = useState<Listing | null>(null)
  // searchCenter: centre utilisé pour le rayon de recherche (La Chapelle par défaut)
  const [searchCenter, setSearchCenter] = useState<[number, number]>(NEIGHBORHOOD_CENTER)
  // userGeoLocation: position GPS réelle (uniquement pour le marqueur bleu)
  const [userGeoLocation, setUserGeoLocation] = useState<[number, number] | null>(null)
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchedLocation, setSearchedLocation] = useState<[number, number] | null>(null)
  const [slugToId, setSlugToId] = useState<Record<string, number>>({})
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [isMobile, setIsMobile] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  // Distingue « pas encore su » de « déconnecté », pour ne pas faire clignoter
  // l'encart de connexion le temps que getUser() réponde.
  const [authResolved, setAuthResolved] = useState(false)
  const supabase = createClient()

  // Suivi de la session
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
      setAuthResolved(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user)
      setAuthResolved(true)
    })
    return () => subscription.unsubscribe()
  }, [])

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

  // Géolocalisation en temps réel — marqueur "Vous êtes ici"
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      pos => setUserGeoLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Détection mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Fetch annonces — ne dépend que du centre de recherche. Le filtrage (catégorie,
  // texte) se fait en mémoire dans le useMemo ci-dessous : sans cette séparation,
  // chaque caractère tapé relançait un select complet dont le résultat était identique.
  const fetchListings = useCallback(async () => {
    setLoading(true)

    // Vue `listings_geo` (migration 032) et non plus le RPC `listings_within_radius` :
    // la vue est en `l.*`, donc toute nouvelle colonne remonte sans migration. Le
    // filtrage par rayon, le calcul de distance et le tri par proximité — que faisait
    // le RPC — sont refaits ici : à l'échelle d'un lotissement c'est quelques dizaines
    // de lignes, et `distance_m` n'était de toute façon affiché nulle part.
    const { data, error } = await supabase
      .from('listings_geo')
      .select('*')

    let fetched: Listing[] | null = !error && data ? (data as Listing[]) : null

    // Repli : tant que la migration 032 n'a pas été appliquée, la vue n'existe
    // pas en base — on retombe sur l'ancien RPC pour ne pas afficher une carte
    // vide pendant la fenêtre migration/déploiement. À retirer quand le RPC
    // sera droppé.
    if (fetched === null) {
      console.warn('[MapView] listings_geo indisponible (migration 032 non appliquée ?) — repli sur le RPC', error?.message)
      const [lat, lng] = searchCenter
      const { data: rpcData } = await supabase.rpc('listings_within_radius', {
        lat, lng, radius_km: NEIGHBORHOOD_RADIUS_KM,
      })
      if (rpcData) fetched = rpcData as Listing[]
    }

    if (fetched) {
      const radiusM = NEIGHBORHOOD_RADIUS_KM * 1000
      setRows(
        fetched
          .map(l => ({
            ...l,
            distance_m: l.lat_out != null && l.lng_out != null
              ? distanceMeters(searchCenter, [l.lat_out, l.lng_out])
              : undefined,
          }))
          .filter(l => l.distance_m === undefined || l.distance_m <= radiusM)
          .sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity))
      )
    }
    setLoading(false)
  }, [searchCenter])

  useEffect(() => { fetchListings() }, [fetchListings])

  // Filtres appliqués en mémoire — aucune requête pendant la frappe.
  const listings = useMemo(() => {
    let filtered = rows

    if (category) {
      const catId = slugToId[category]
      if (catId !== undefined) {
        filtered = filtered.filter(l => l.category_id === catId)
      }
    }
    if (search.trim()) {
      const term = normalizeSearch(search.trim())
      filtered = filtered.filter(l =>
        normalizeSearch(l.title).includes(term) ||
        normalizeSearch(l.description ?? '').includes(term)
      )
    }

    return filtered
  }, [rows, category, search, slugToId])

  return (
      <div className="flex flex-col h-full">
        {/* Header desktop — pleine largeur, au-dessus de la carte et de la sidebar */}
        <div className="hidden md:flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-brand-600" />
            <h1 className="text-base font-bold text-gray-900">Publications du quartier</h1>
          </div>
          {isLoggedIn && (
            <button
              onClick={() => router.push('/listings/new')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Plus size={15} /> Publier une annonce
            </button>
          )}
        </div>

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

        {/* Body: sidebar + map */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

        {/* Sidebar */}
        <div className={`w-full md:w-96 flex flex-col bg-white border-r border-gray-200 overflow-hidden z-10 ${mobileView === 'map' ? 'hidden md:flex' : 'flex'}`}>
          <FilterBar
              category={category}
              onCategoryChange={setCategory}
              count={listings.length}
              loading={loading}
              search={search}
              onSearchChange={setSearch}
          />

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-brand-600" size={28} />
                </div>
            ) : authResolved && !isLoggedIn ? (
                // En desktop le voile sur la carte porte déjà les boutons, on évite
                // de répéter le même appel à l'action côte à côte.
                <LoginRequiredNotice
                  what="les annonces de votre quartier"
                  redirectTo="/map"
                  compact={!isMobile}
                />
            ) : listings.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <MapPin size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Aucune annonce disponible</p>
                  <p className="text-sm mt-1">Essayez de modifier vos filtres</p>
                </div>
            ) : (
                listings.map(listing => (
                    <ListingCard
                        key={listing.id}
                        listing={listing}
                        compact
                        outlineOnly
                        onClick={isMobile && mobileView === 'list' ? undefined : () => setSelected(listing)}
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

          {/* Voile visiteur non connecté : la carte serait sinon affichée vide,
              ce qui suggère « il n'y a rien ici » au lieu de « connectez-vous ».
              Indispensable en vue mobile « Carte », où l'encart de la liste
              latérale n'est pas visible.
              ⚠️ Purement visuel : ce qui protège réellement les annonces est le
              RLS (migration 030), pas ce voile. */}
          {authResolved && !isLoggedIn && (
              <div className="map-login-veil absolute inset-0 z-[1150] flex items-center justify-center p-4">
                <div className="bg-surface rounded-2xl shadow-xl border border-edge max-w-sm w-full">
                  <LoginRequiredNotice what="les annonces de votre quartier" redirectTo="/map" />
                </div>
              </div>
          )}

          {/* Popup détail sélectionné */}
          {selected && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-80 z-[1200] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl shadow-xl">
                <div className="relative">
                  <button onClick={() => setSelected(null)}
                          className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md border border-gray-200 z-10">
                    <X size={14} />
                  </button>
                  <ListingCard listing={selected} outlineOnly />
                </div>
              </div>
          )}
        </div>

        </div>{/* end Body */}

        {/* FAB mobile — Publier une annonce (connecté uniquement) */}
        {isLoggedIn && (
        <button
          onClick={() => router.push('/listings/new')}
          className={cn(
            'fixed md:hidden z-[1100]',
            'w-14 h-14 rounded-full bg-brand-600 text-white shadow-xl',
            'flex items-center justify-center',
            'hover:bg-brand-700 active:scale-95 transition-all duration-150',
            'right-4 bottom-6',
          )}
          aria-label="Publier une annonce"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
        )}
      </div>
  )
}
