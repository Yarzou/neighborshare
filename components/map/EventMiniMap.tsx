'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pinIconHtml = `
  <div style="display:flex;flex-direction:column;align-items:center;gap:0">
    <div style="
      width:22px;height:22px;
      background:#16a34a;
      border:2.5px solid white;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    "></div>
    <div style="width:2px;height:10px;background:#16a34a;margin-top:-1px;border-radius:0 0 2px 2px"></div>
  </div>
`

interface Props {
  lat: number
  lng: number
  label?: string
  className?: string
  zoom?: number
}

export default function EventMiniMap({ lat, lng, label, className = 'w-full h-40 rounded-2xl', zoom = 15 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom,
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

    const icon = L.divIcon({
      html: pinIconHtml,
      iconSize: [22, 32],
      iconAnchor: [11, 32],
      className: '',
    })

    const marker = L.marker([lat, lng], { icon }).addTo(map)
    if (label) marker.bindPopup(label)

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current!)

    mapRef.current = map

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [lat, lng, label, zoom])

  return <div ref={containerRef} className={className} />
}
