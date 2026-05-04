'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
  departureLat: number
  departureLng: number
  departureLabel?: string
  arrivalLat: number
  arrivalLng: number
  arrivalLabel?: string
  className?: string
}

const departureIconHtml = `
  <div style="display:flex;flex-direction:column;align-items:center;gap:0">
    <div style="
      width:20px;height:20px;
      background:#16a34a;
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
        <rect x="1" y="1" width="2" height="8" rx="0.5"/>
        <polygon points="3,1 9,3.5 3,6"/>
      </svg>
    </div>
    <div style="width:2px;height:8px;background:#16a34a;margin-top:-1px"></div>
  </div>
`

const arrivalIconHtml = `
  <div style="display:flex;flex-direction:column;align-items:center;gap:0">
    <div style="
      width:20px;height:20px;
      background:#dc2626;
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
        <rect x="1" y="1" width="2" height="8" rx="0.5"/>
        <polygon points="3,1 9,3.5 3,6"/>
      </svg>
    </div>
    <div style="width:2px;height:8px;background:#dc2626;margin-top:-1px"></div>
  </div>
`

export default function CarpoolMiniMap({
  departureLat, departureLng, departureLabel = 'Départ',
  arrivalLat, arrivalLng, arrivalLabel = 'Arrivée',
  className = 'w-full h-44',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    const depIcon = L.divIcon({ html: departureIconHtml, iconSize: [20, 28], iconAnchor: [10, 28], className: '' })
    const arrIcon = L.divIcon({ html: arrivalIconHtml, iconSize: [20, 28], iconAnchor: [10, 28], className: '' })

    L.marker([departureLat, departureLng], { icon: depIcon })
      .bindPopup(departureLabel)
      .addTo(map)

    L.marker([arrivalLat, arrivalLng], { icon: arrIcon })
      .bindPopup(arrivalLabel)
      .addTo(map)

    L.polyline(
      [[departureLat, departureLng], [arrivalLat, arrivalLng]],
      { color: '#6366f1', weight: 2.5, dashArray: '6 4', opacity: 0.8 }
    ).addTo(map)

    const bounds = L.latLngBounds(
      [departureLat, departureLng],
      [arrivalLat, arrivalLng]
    )
    map.fitBounds(bounds, { padding: [24, 24] })

    mapRef.current = map

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current!)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [departureLat, departureLng, arrivalLat, arrivalLng, departureLabel, arrivalLabel])

  return <div ref={containerRef} className={`carpool-mini-map ${className ?? ''}`} />
}
