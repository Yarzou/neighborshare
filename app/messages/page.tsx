import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default async function MessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Récupère les conversations (dernier message par annonce)
  const { data: messages } = await supabase
    .from('messages')
    .select('*, listings(title, id), sender:profiles!sender_id(username, full_name), receiver:profiles!receiver_id(username, full_name)')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  // Déduplique par listing_id
  const seen = new Set<string>()
  const conversations = (messages || []).filter(m => {
    if (seen.has(m.listing_id)) return false
    seen.add(m.listing_id)
    return true
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <MessageCircle className="text-brand-600" size={26} />
        Mes messages
      </h1>

      {conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Aucun message pour l&apos;instant</p>
          <p className="text-sm mt-1">Contactez un voisin depuis une annonce !</p>
          <Link href="/map" className="inline-flex mt-4 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors">
            Explorer la carte
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map(conv => {
            const other = conv.sender_id === user.id ? conv.receiver : conv.sender
            const isUnread = !conv.read && conv.receiver_id === user.id
            return (
              <Link key={conv.id} href={`/messages/${conv.listing_id}`}
                className={`bg-white rounded-2xl border p-4 flex items-center gap-4 hover:border-brand-300 transition-colors ${isUnread ? 'border-brand-200 bg-brand-50/30' : 'border-gray-200'}`}>
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold flex-shrink-0">
                  {(other as any)?.full_name?.[0] || (other as any)?.username?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">
                      {(other as any)?.full_name || (other as any)?.username}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatDate(conv.created_at)}</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">
                    <span className="text-gray-400">re: </span>{(conv as any).listings?.title}
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-0.5">{conv.content}</p>
                </div>
                {isUnread && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
