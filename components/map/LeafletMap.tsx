'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { Listing } from '@/lib/types'
import { getCategoryEmoji } from '@/lib/categories'

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
  visible?: boolean
}

export default function LeafletMap({ userPosition, listings, onSelectListing, selectedId, searchedLocation, visible }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchMarkerRef = useRef<L.Marker | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  // Timer ref to delay unspiderfy so hovering child markers doesn't collapse immediately
  const unspiderfyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Init map centered on neighborhood
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView(NEIGHBORHOOD_CENTER, 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Cluster group with custom cluster icon
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false, // we handle click ourselves
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        return L.divIcon({
          html: `<div class="cluster-bubble">${count}</div>`,
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })
      },
    })

    // Desktop: hover → spiderfy / mouseleave → delayed unspiderfy
    clusterGroup.on('clustermouseover', (e: any) => {
      if (unspiderfyTimerRef.current) {
        clearTimeout(unspiderfyTimerRef.current)
        unspiderfyTimerRef.current = null
      }
      e.layer.spiderfy()
    })

    clusterGroup.on('clustermouseout', (e: any) => {
      unspiderfyTimerRef.current = setTimeout(() => {
        ;(clusterGroup as any).unspiderfy()
      }, 200)
    })

    // Mobile / fallback: click → spiderfy
    clusterGroup.on('clusterclick', (e: any) => {
      if (unspiderfyTimerRef.current) {
        clearTimeout(unspiderfyTimerRef.current)
        unspiderfyTimerRef.current = null
      }
      e.layer.spiderfy()
    })

    clusterGroup.addTo(map)
    clusterGroupRef.current = clusterGroup
    mapRef.current = map

    // ResizeObserver : recalcule la taille dès que le conteneur change de dimensions
    // (ex : passage de hidden → visible sur mobile)
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(containerRef.current)

    return () => {
      if (unspiderfyTimerRef.current) clearTimeout(unspiderfyTimerRef.current)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      clusterGroupRef.current = null
    }
  }, [])

  // Recalcule la taille quand la vue mobile bascule sur "carte"
  useEffect(() => {
    if (visible && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 50)
    }
  }, [visible])

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
    const clusterGroup = clusterGroupRef.current
    if (!map || !clusterGroup) return

    // Remove all existing markers from cluster and clear refs
    clusterGroup.clearLayers()
    markersRef.current = {}

    listings.forEach(listing => {
      if (!listing.lat_out || !listing.lng_out) return

      const isDemande = listing.listing_intent === 'demande'
      const icon = L.divIcon({
        html: `<div class="custom-marker${isDemande ? ' custom-marker--demande' : ''}" title="${listing.title}">${getCategoryEmoji(listing.category_id)}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        className: '',
      })

      const marker = L.marker([listing.lat_out, listing.lng_out], { icon })
        .on('click', () => onSelectListing(listing))
        // Cancel unspiderfy when hovering a child marker
        .on('mouseover', () => {
          if (unspiderfyTimerRef.current) {
            clearTimeout(unspiderfyTimerRef.current)
            unspiderfyTimerRef.current = null
          }
        })
        .on('mouseout', () => {
          unspiderfyTimerRef.current = setTimeout(() => {
            ;(clusterGroupRef.current as any)?.unspiderfy()
          }, 200)
        })

      clusterGroup.addLayer(marker)
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
