'use client'

import { SlidersHorizontal, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FILTER_CATEGORIES } from '@/lib/categories'
import { CategoryIcon } from '@/components/listings/CategoryIcon'

interface Props {
  category: string
  onCategoryChange: (c: string) => void
  count: number
  loading: boolean
  search: string
  onSearchChange: (s: string) => void
}

export function FilterBar({ category, onCategoryChange, count, loading, search, onSearchChange }: Props) {
  return (
    <div className="border-b border-gray-200 bg-gray-50 md:bg-surface-pane px-3 pt-3 pb-2 flex flex-col gap-2">
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

      {/* Keyword search — champ gris sans bordure, comme la recherche iOS */}
      <div className="relative flex items-center">
        <Search size={15} className="absolute left-3 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Rechercher une annonce…"
          aria-label="Rechercher une annonce"
          className="w-full pl-9 pr-8 py-2 rounded-[10px] text-sm bg-gray-100 border border-transparent focus:outline-none focus:border-brand-400 placeholder:text-gray-500"
        />
        {search && (
          <button onClick={() => onSearchChange('')} aria-label="Effacer la recherche"
            className="absolute right-2.5 text-gray-500 hover:text-gray-700">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Categories : pastilles blanches, l'icône en vert ; la catégorie choisie en plein */}
      <div className="grid grid-cols-3 gap-1.5">
        {FILTER_CATEGORIES.map(cat => {
          const active = category === cat.slug
          return (
            <button key={cat.slug} onClick={() => onCategoryChange(cat.slug)} aria-pressed={active}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-xs font-medium transition-colors border w-full',
                active
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300',
              )}>
              <CategoryIcon slug={cat.slug} size={14} className={active ? undefined : 'text-brand-600'} />
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
