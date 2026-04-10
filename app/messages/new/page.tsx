'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Search, X, Users, Loader2, Check, AlertCircle } from 'lucide-react'
import type { Profile } from '@/lib/types'

export default function NewConversationPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Profile[]>([])
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth/login?redirect=%2Fmessages%2Fnew')
        return
      }
      setUserId(user.id)
    })
  }, [])

  // Recherche utilisateurs avec debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, rating, rating_count, created_at')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq('id', userId ?? '')
        .limit(8)
      setResults(data ?? [])
      setSearching(false)
    }, 350)
  }, [query, userId])

  const toggleSelect = (profile: Profile) => {
    setSelected(prev =>
      prev.find(p => p.id === profile.id)
        ? prev.filter(p => p.id !== profile.id)
        : [...prev, profile]
    )
  }

  const isSelected = (id: string) => selected.some(p => p.id === id)

  const handleCreate = async () => {
    if (selected.length === 0) return
    setCreating(true)
    setError(null)

    const isGroup = selected.length > 1
    const name = isGroup
      ? (groupName.trim() || selected.map(p => p.full_name || p.username).join(', '))
      : null

    const { data: convId, error: rpcErr } = await supabase.rpc('create_conversation', {
      participant_ids: selected.map(p => p.id),
      conv_name: name,
    })

    if (rpcErr || !convId) {
      setError('Impossible de créer la conversation. Réessayez.')
      setCreating(false)
      return
    }

    router.push(`/messages/${convId}`)
  }

  const isGroup = selected.length > 1

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/messages" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Retour aux messages
      </Link>

      <h1 className="text-2xl font-bold mb-1">Nouvelle conversation</h1>
      <p className="text-sm text-gray-500 mb-6">Recherchez un ou plusieurs voisins pour démarrer une discussion.</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 mb-4 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Participants sélectionnés */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selected.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-100 text-brand-700 rounded-full text-sm font-medium">
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">
                {(p.full_name || p.username)[0].toUpperCase()}
              </span>
              {p.full_name || p.username}
              <button onClick={() => toggleSelect(p)} className="ml-1 text-brand-400 hover:text-brand-700">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Nom du groupe (si plusieurs) */}
      {isGroup && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Users size={14} /> Nom du groupe (optionnel)
          </label>
          <input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Ex : Voisins du quartier…"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Recherche */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher par nom ou pseudo…"
          className="w-full pl-10 pr-9 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
        />
        {searching && (
          <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
        {!searching && query && (
          <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Résultats */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          {results.map((profile, i) => {
            const sel = isSelected(profile.id)
            return (
              <button
                key={profile.id}
                onClick={() => toggleSelect(profile)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i > 0 ? 'border-t border-gray-50' : ''} ${sel ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${sel ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'}`}>
                  {sel ? <Check size={16} /> : (profile.full_name || profile.username)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name || profile.username}</p>
                  <p className="text-xs text-gray-400 truncate">@{profile.username}</p>
                </div>
                {sel && <Check size={15} className="text-brand-600 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}

      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">Aucun utilisateur trouvé pour &quot;{query}&quot;</p>
      )}

      {/* Bouton démarrer */}
      <button
        onClick={handleCreate}
        disabled={selected.length === 0 || creating}
        className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {creating ? (
          <><Loader2 size={17} className="animate-spin" /> Création…</>
        ) : isGroup ? (
          <><Users size={17} /> Créer le groupe ({selected.length + 1} participants)</>
        ) : selected.length === 1 ? (
          `Démarrer avec ${selected[0].full_name || selected[0].username}`
        ) : (
          'Sélectionnez au moins un utilisateur'
        )}
      </button>
    </div>
  )
}
