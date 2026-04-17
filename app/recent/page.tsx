'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ListingCard } from '@/components/listings/ListingCard'
import type { Listing } from '@/lib/types'
import { Loader2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 12

export default function RecentPage() {
  const supabase = createClient()

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user))
  }, [])

  const fetchListings = useCallback(async (p: number) => {
    setLoading(true)
    const from = p * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, count } = await supabase
      .from('listings')
      .select('*, categories(*), profiles!user_id(id, username, full_name, avatar_url)', { count: 'exact' })
      .eq('status', 'disponible')
      .order('created_at', { ascending: false })
      .range(from, to)

    setListings((data ?? []) as Listing[])
    if (count !== null) setTotal(count)
    setLoading(false)
  }, [])

  useEffect(() => { fetchListings(page) }, [page, fetchListings])

  const totalPages = Math.ceil(total / PAGE_SIZE)

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
      <p className="text-gray-500 text-sm mb-8">
        Les annonces les plus récentes du quartier du Cèdre.
      </p>

      {!isLoggedIn && (
        <div className="bg-brand-50 border border-brand-100 rounded-2xl px-5 py-4 mb-8 flex items-center justify-between gap-4 flex-wrap">
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

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-brand-600" size={32} />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Sparkles size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Aucune annonce pour le moment</p>
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
            {total} annonce{total > 1 ? 's' : ''} au total
          </p>
        </>
      )}
    </div>
  )
}
