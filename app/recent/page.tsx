'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ListingCard } from '@/components/listings/ListingCard'
import type { Listing } from '@/lib/types'
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn, normalizeSearch } from '@/lib/utils'

const PAGE_SIZE = 12

const CATEGORIES = [
  { slug: '', label: 'Tout', icon: '🗺️' },
  { slug: 'outils', label: 'Outils', icon: '🔧' },
  { slug: 'services', label: 'Services', icon: '🤝' },
  { slug: 'garde-enfant', label: 'Enfants', icon: '👶' },
  { slug: 'covoiturage', label: 'Trajet', icon: '🚗' },
  { slug: 'dons', label: 'Dons', icon: '📦' },
  { slug: 'jardinage', label: 'Jardin', icon: '🌿' },
]

export default function RecentPage() {
  const supabase = createClient()

  const [allListings, setAllListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [slugToId, setSlugToId] = useState<Record<string, number>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user))
    supabase.from('categories').select('id, slug').then(({ data }) => {
      if (data) {
        const map: Record<string, number> = {}
        data.forEach(c => { map[c.slug] = c.id })
        setSlugToId(map)
      }
    })
  }, [])

  const isFiltering = search.trim().length > 0

  // Quand une recherche texte est active, on charge un set plus large côté serveur
  // puis on filtre côté client pour garantir la recherche insensible aux accents.
  const fetchListings = useCallback(async (p: number) => {
    setLoading(true)

    let query = supabase
      .from('listings')
      .select('*, categories(*), profiles!user_id(id, username, full_name, avatar_url)', { count: 'exact' })
      .eq('status', 'disponible')
      .order('created_at', { ascending: false })

    if (category && slugToId[category] !== undefined) {
      query = query.eq('category_id', slugToId[category])
    }

    if (isFiltering) {
      // Pas de pagination : on charge jusqu'à 500 annonces pour la recherche client
      query = query.limit(500)
    } else {
      const from = p * PAGE_SIZE
      query = query.range(from, from + PAGE_SIZE - 1)
    }

    const { data, count } = await query

    setAllListings((data ?? []) as Listing[])
    if (count !== null) setTotal(count)
    setLoading(false)
  }, [category, slugToId, isFiltering])

  // Recharge quand catégorie ou mode filtrage change, reset page
  useEffect(() => {
    setPage(0)
  }, [category, search])

  useEffect(() => {
    fetchListings(page)
  }, [page, fetchListings])

  // Filtrage texte côté client (insensible aux accents)
  const listings = isFiltering
    ? allListings.filter(l => {
        const term = normalizeSearch(search.trim())
        return (
          normalizeSearch(l.title).includes(term) ||
          normalizeSearch(l.description ?? '').includes(term)
        )
      })
    : allListings

  const totalPages = isFiltering ? 1 : Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Sparkles size={22} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Derniers ajouts</h1>
        </div>
        {!isLoggedIn && (
          <Link href="/auth/register"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">
            Rejoindre le quartier
          </Link>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Les annonces les plus récentes du quartier du Cèdre.
      </p>

      {!isLoggedIn && (
        <div className="bg-brand-50 border border-brand-100 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-brand-800">
            🏘️ <span className="font-medium">Vous êtes voisin·e ?</span> Inscrivez-vous pour publier une annonce et contacter vos voisins.
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/auth/login" className="px-3 py-1.5 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors">
              Connexion
            </Link>
            <Link href="/auth/register" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">
              S&apos;inscrire
            </Link>
          </div>
        </div>
      )}

      {/* Barre de recherche + filtres */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-6 flex flex-col gap-3">
        {/* Recherche texte */}
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une annonce…"
            className="w-full pl-9 pr-8 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-400 placeholder:text-gray-400 bg-gray-50"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtres catégories */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button key={cat.slug} onClick={() => setCategory(cat.slug)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                category === cat.slug
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'
              )}>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-brand-600" size={32} />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Sparkles size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Aucune annonce trouvée</p>
          {(search || category) && (
            <button onClick={() => { setSearch(''); setCategory('') }}
              className="mt-3 text-sm text-brand-600 hover:underline">
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} /> Précédent
              </button>

              <span className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-900">{page + 1}</span> / {totalPages}
              </span>

              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Suivant <ChevronRight size={16} />
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-4">
            {isFiltering
              ? `${listings.length} résultat${listings.length > 1 ? 's' : ''}`
              : `${total} annonce${total > 1 ? 's' : ''} au total`}
          </p>
        </>
      )}
    </div>
  )
}
