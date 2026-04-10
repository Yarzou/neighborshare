'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, X, Loader2, Search, Check, Navigation } from 'lucide-react'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    postcode?: string
    country?: string
  }
}

export interface ResolvedAddress {
  displayName: string
  lat: number
  lon: number
  road: string
  city: string
}

interface Props {
  /** Adresse déjà validée (mode édition) — affiche l'état "verrouillé" d'emblée */
  lockedValue?: string
  onSelect: (result: ResolvedAddress) => void
  onClear: () => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
}

export default function AddressAutocomplete({
  lockedValue,
  onSelect,
  onClear,
  placeholder = 'Rechercher une adresse…',
  disabled = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [sugLoading, setSugLoading] = useState(false)
  const [locked, setLocked] = useState(!!lockedValue)
  const [lockedText, setLockedText] = useState(lockedValue ?? '')
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync si lockedValue change depuis l'extérieur (chargement async en mode édition)
  useEffect(() => {
    if (lockedValue) {
      setLockedText(lockedValue)
      setLocked(true)
    }
  }, [lockedValue])

  // Ferme le dropdown si clic en dehors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Recherche avec debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 3) { setSuggestions([]); setSugLoading(false); return }
    setSugLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'fr' } }
        )
        const data: NominatimResult[] = await res.json()
        setSuggestions(data)
      } catch {
        setSuggestions([])
      } finally {
        setSugLoading(false)
      }
    }, 400)
  }, [query])

  const resolveResult = (result: NominatimResult, lat: number, lon: number): ResolvedAddress => {
    const addr = result.address
    const road = [addr.house_number, addr.road].filter(Boolean).join(' ')
    const city = addr.city ?? addr.town ?? addr.village ?? ''
    return { displayName: result.display_name, lat, lon, road, city }
  }

  const confirmSelection = (resolved: ResolvedAddress, displayText: string) => {
    setLockedText(displayText)
    setLocked(true)
    setSuggestions([])
    setQuery('')
    onSelect(resolved)
  }

  const handleSelect = (result: NominatimResult) => {
    const resolved = resolveResult(result, parseFloat(result.lat), parseFloat(result.lon))
    confirmSelection(resolved, result.display_name)
  }

  const handleClear = () => {
    setLocked(false)
    setLockedText('')
    setQuery('')
    setSuggestions([])
    setGeoError(null)
    onClear()
  }

  const handleGeo = () => {
    if (!navigator.geolocation) {
      setGeoError('La géolocalisation n\'est pas supportée par votre navigateur.')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'fr' } }
          )
          const data: NominatimResult = await res.json()
          const resolved = resolveResult(data, lat, lon)
          confirmSelection(resolved, data.display_name)
        } catch {
          setGeoError('Impossible de déterminer votre adresse à partir de votre position.')
        } finally {
          setGeoLoading(false)
        }
      },
      () => {
        setGeoError('Accès à la position refusé ou indisponible.')
        setGeoLoading(false)
      }
    )
  }

  // ── État verrouillé : adresse confirmée ──
  if (locked) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-brand-500 bg-brand-50 text-brand-700 text-sm">
          <Check size={15} className="flex-shrink-0 text-brand-600" />
          <span className="flex-1 truncate text-sm leading-snug">{lockedText}</span>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="flex-shrink-0 text-brand-400 hover:text-brand-700 transition-colors ml-1"
            title="Modifier / supprimer l'adresse"
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-xs text-gray-400 pl-1">Cliquez sur ✕ pour modifier l&apos;adresse</p>
      </div>
    )
  }

  // ── État de saisie ──
  return (
    <div ref={containerRef} className="flex flex-col gap-2 relative">
      {/* Champ de recherche */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full pl-10 pr-9 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm disabled:opacity-50"
        />
        {sugLoading && (
          <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin pointer-events-none" />
        )}
        {!sugLoading && query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSuggestions([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Dropdown suggestions */}
      {suggestions.length > 0 && (
        <ul className="absolute top-[calc(100%-0.5rem)] mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          {suggestions.map(s => (
            <li key={s.place_id} className="border-b border-gray-50 last:border-0">
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50 flex items-start gap-2.5 transition-colors"
              >
                <MapPin size={13} className="mt-0.5 text-brand-500 flex-shrink-0" />
                <span className="line-clamp-2 leading-snug">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Bouton géolocalisation */}
      <button
        type="button"
        onClick={handleGeo}
        disabled={disabled || geoLoading}
        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
      >
        {geoLoading
          ? <Loader2 size={14} className="animate-spin" />
          : <Navigation size={14} />
        }
        Utiliser ma position actuelle
      </button>

      {geoError && (
        <p className="text-xs text-red-500 pl-1">{geoError}</p>
      )}
    </div>
  )
}
