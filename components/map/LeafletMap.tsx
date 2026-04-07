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

interface Props {
  center: [number, number]
  listings: Listing[]
  onSelectListing: (listing: Listing) => void
  selectedId?: string
}

export default function LeafletMap({ center, listings, onSelectListing, selectedId }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView(center, 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Marqueur position utilisateur
    const userIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.2)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: '',
    })
    L.marker(center, { icon: userIcon }).addTo(map).bindPopup('Vous êtes ici')

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

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
