'use client'

import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, Loader2, Search, MapPin, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { slug: '', label: 'Tout', icon: '🗺️' },
  { slug: 'outils', label: 'Outils', icon: '🔧' },
  { slug: 'services', label: 'Services', icon: '🤝' },
  { slug: 'garde-enfant', label: 'Enfants', icon: '👶' },
  { slug: 'covoiturage', label: 'Trajet', icon: '🚗' },
  { slug: 'dons', label: 'Dons', icon: '📦' },
  { slug: 'jardinage', label: 'Jardin', icon: '🌿' },
  { slug: 'cuisine', label: 'Cuisine', icon: '🍳' },
]

const RADII = [1, 2, 5, 10, 20]

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

interface Props {
  radius: number
  onRadiusChange: (r: number) => void
  category: string
  onCategoryChange: (c: string) => void
  count: number
  loading: boolean
  onLocationSelect: (lat: number, lon: number) => void
  search: string
  onSearchChange: (s: string) => void
}

export function FilterBar({ radius, onRadiusChange, category, onCategoryChange, count, loading, onLocationSelect, search, onSearchChange }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setError(null)

    if (query.trim().length < 3) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setFetching(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
        const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } })
        const data: NominatimResult[] = await res.json()
        setSuggestions(data)
        setShowDropdown(data.length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setFetching(false)
      }
    }, 400)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectSuggestion = (s: NominatimResult) => {
    setQuery(s.display_name)
    setShowDropdown(false)
    setSuggestions([])
    onLocationSelect(parseFloat(s.lat), parseFloat(s.lon))
  }

  const handleSubmit = async () => {
    if (!query.trim()) return
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0])
      return
    }
    // Fallback: direct geocode if no suggestions cached
    setFetching(true)
    setError(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
      const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } })
      const data: NominatimResult[] = await res.json()
      if (data.length === 0) { setError('Adresse introuvable'); return }
      selectSuggestion(data[0])
    } catch {
      setError('Erreur lors de la recherche')
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="border-b border-gray-100 bg-white px-3 pt-3 pb-2 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <SlidersHorizontal size={15} />
          Filtres
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          {loading ? <Loader2 size={12} className="animate-spin" /> : null}
          {loading ? 'Chargement...' : `${count} annonce${count > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Keyword search */}
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Rechercher une annonce…"
          className="w-full pl-8 pr-3 py-1.5 rounded-full text-xs border border-gray-200 focus:outline-none focus:border-brand-400 placeholder:text-gray-400 bg-gray-50"
        />
        {search && (
          <button onClick={() => onSearchChange('')}
            className="absolute right-2.5 text-gray-400 hover:text-gray-600">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="grid grid-cols-4 gap-1.5">
        {CATEGORIES.map(cat => (
          <button key={cat.slug} onClick={() => onCategoryChange(cat.slug)}
            className={cn(
              'flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-colors border w-full',
              category === cat.slug
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'
            )}>
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Radius */}
      {/*<div className="flex items-center gap-2">*/}
      {/*  <span className="text-xs text-gray-500 flex-shrink-0">Rayon :</span>*/}
      {/*  <div className="flex gap-1">*/}
      {/*    {RADII.map(r => (*/}
      {/*      <button key={r} onClick={() => onRadiusChange(r)}*/}
      {/*        className={cn(*/}
      {/*          'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',*/}
      {/*          radius === r*/}
      {/*            ? 'bg-brand-600 text-white border-brand-600'*/}
      {/*            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'*/}
      {/*        )}>*/}
      {/*        {r} km*/}
      {/*      </button>*/}
      {/*    ))}*/}
      {/*  </div>*/}
      {/*</div>*/}

      {/* Address search with autocomplete */}
      {/*<div ref={wrapperRef} className="relative">*/}
      {/*  <div className="flex items-center gap-1.5">*/}
      {/*    <input*/}
      {/*      type="text"*/}
      {/*      value={query}*/}
      {/*      onChange={e => setQuery(e.target.value)}*/}
      {/*      onKeyDown={e => e.key === 'Enter' && handleSubmit()}*/}
      {/*      onFocus={() => suggestions.length > 0 && setShowDropdown(true)}*/}
      {/*      placeholder="Rechercher par adresse…"*/}
      {/*      className="flex-1 text-xs border border-gray-200 rounded-full px-3 py-1.5 outline-none focus:border-brand-400 placeholder:text-gray-400"*/}
      {/*    />*/}
      {/*    <button*/}
      {/*      onClick={handleSubmit}*/}
      {/*      disabled={fetching || !query.trim()}*/}
      {/*      className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"*/}
      {/*    >*/}
      {/*      {fetching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}*/}
      {/*    </button>*/}
      {/*  </div>*/}

        {/* Dropdown suggestions */}
      {/*  {showDropdown && suggestions.length > 0 && (*/}
      {/*    <ul className="absolute left-0 right-8 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">*/}
      {/*      {suggestions.map((s, i) => (*/}
      {/*        <li key={i}>*/}
      {/*          <button*/}
      {/*            onMouseDown={e => { e.preventDefault(); selectSuggestion(s) }}*/}
      {/*            className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-brand-50 transition-colors"*/}
      {/*          >*/}
      {/*            <MapPin size={13} className="text-brand-500 mt-0.5 flex-shrink-0" />*/}
      {/*            <span className="text-xs text-gray-700 line-clamp-2 leading-snug">{s.display_name}</span>*/}
      {/*          </button>*/}
      {/*        </li>*/}
      {/*      ))}*/}
      {/*    </ul>*/}
      {/*  )}*/}

        {/* Error */}
      {/*  {error && (*/}
      {/*    <p className="mt-1 text-xs text-red-500 pl-1">{error}</p>*/}
      {/*  )}*/}
      {/*</div>*/}
    </div>
  )
}
