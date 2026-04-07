import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Star, Package } from 'lucide-react'
import { ListingCard } from '@/components/listings/ListingCard'
import { formatDate } from '@/lib/utils'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: listings } = await supabase
    .from('listings')
    .select('*, categories(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Profile card */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 flex items-center gap-5 mb-8">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-2xl flex-shrink-0">
          {profile?.full_name?.[0] || profile?.username?.[0] || '?'}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{profile?.full_name || profile?.username}</h1>
          <p className="text-gray-400 text-sm">@{profile?.username}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              {profile?.rating?.toFixed(1) || '—'} ({profile?.rating_count || 0} avis)
            </span>
            <span className="flex items-center gap-1">
              <Package size={14} />
              {listings?.length || 0} annonce{(listings?.length || 0) > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Mes annonces */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Package size={18} className="text-brand-600" /> Mes annonces
      </h2>

      {!listings || listings.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <Package size={36} className="mx-auto mb-2 opacity-20" />
          <p>Vous n&apos;avez pas encore d&apos;annonces</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  )
}
