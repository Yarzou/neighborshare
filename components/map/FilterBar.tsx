'use client'

import { SlidersHorizontal, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { slug: '', label: 'Tout', icon: '🗺️' },
  { slug: 'outils', label: 'Outils', icon: '🔧' },
  { slug: 'services', label: 'Services', icon: '🤝' },
  { slug: 'garde-enfant', label: 'Enfants', icon: '👶' },
  { slug: 'covoiturage', label: 'Trajet', icon: '🚗' },
  { slug: 'dons', label: 'Dons', icon: '📦' },
  { slug: 'jardinage', label: 'Jardin', icon: '🌿' },
]

const RADII = [1, 2, 5, 10, 20]

interface Props {
  radius: number
  onRadiusChange: (r: number) => void
  category: string
  onCategoryChange: (c: string) => void
  count: number
  loading: boolean
}

export function FilterBar({ radius, onRadiusChange, category, onCategoryChange, count, loading }: Props) {
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

      {/* Categories */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button key={cat.slug} onClick={() => onCategoryChange(cat.slug)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border',
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
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 flex-shrink-0">Rayon :</span>
        <div className="flex gap-1">
          {RADII.map(r => (
            <button key={r} onClick={() => onRadiusChange(r)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                radius === r
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'
              )}>
              {r} km
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
