'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Listing } from '@/lib/types'

// Fix icônes Leaflet avec Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const NEIGHBORHOOD_CENTER: [number, number] = [47.300837, -1.560131]

interface Props {
  userPosition: [number, number] | null
  listings: Listing[]
  onSelectListing: (listing: Listing) => void
  selectedId?: string
  searchedLocation?: [number, number] | null
}

export default function LeafletMap({ userPosition, listings, onSelectListing, selectedId, searchedLocation }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const searchMarkerRef = useRef<L.Marker | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)

  // Init map centered on neighborhood
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView(NEIGHBORHOOD_CENTER, 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update user position marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userPosition) return

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userPosition)
      return
    }

    const userIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.2)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: '',
    })
    userMarkerRef.current = L.marker(userPosition, { icon: userIcon }).addTo(map).bindPopup('Vous êtes ici')
  }, [userPosition])

  // Searched address marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove previous search marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove()
      searchMarkerRef.current = null
    }

    if (!searchedLocation) return

    const searchIcon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;
        background:#dc2626;
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(0,0,0,0.3)
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      className: '',
    })

    searchMarkerRef.current = L.marker(searchedLocation, { icon: searchIcon })
        .addTo(map)
        .bindPopup('📍 Adresse recherchée')
        .openPopup()

    map.setView(searchedLocation, 14)
  }, [searchedLocation])

  // Update markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Supprimer anciens markers
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    listings.forEach(listing => {
      if (!listing.lat_out || !listing.lng_out) return

      const icon = L.divIcon({
        html: `<div class="custom-marker" title="${listing.title}">${getCategoryIcon(listing.category_id)}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        className: '',
      })

      const marker = L.marker([listing.lat_out, listing.lng_out], { icon })
          .addTo(map)
          .on('click', () => onSelectListing(listing))

      markersRef.current[listing.id] = marker
    })
  }, [listings, onSelectListing])

  // Highlight selected
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement()
      if (!el) return
      const inner = el.querySelector('.custom-marker') as HTMLElement
      if (!inner) return
      inner.style.borderColor = id === selectedId ? '#dc2626' : '#16a34a'
      inner.style.transform = id === selectedId ? 'scale(1.2)' : 'scale(1)'
    })
  }, [selectedId])

  return <div ref={containerRef} className="w-full h-full" />
}

function getCategoryIcon(categoryId: number | null): string {
  const icons: Record<number, string> = {
    1: '🔧', 2: '🤝', 3: '👶', 4: '🚗', 5: '📦', 6: '🌿',
  }
  return categoryId ? (icons[categoryId] || '📍') : '📍'
}
