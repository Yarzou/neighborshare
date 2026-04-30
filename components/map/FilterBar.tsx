'use client'

import { SlidersHorizontal, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FILTER_CATEGORIES } from '@/lib/categories'

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
        {FILTER_CATEGORIES.map(cat => (
          <button key={cat.slug} onClick={() => onCategoryChange(cat.slug)}
            className={cn(
              'flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-colors border w-full',
              category === cat.slug
                ? 'bg-brand-600 text-white border-brand-600'
                : cat.color
                  ? cn(cat.color, cat.hoverColor, 'text-gray-700')
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'
            )}>
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
