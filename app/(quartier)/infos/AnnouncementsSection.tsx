'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Pin, Plus, Loader2, X, Trash2 } from 'lucide-react'
import type { Announcement } from '@/lib/types'
import { formatDate, getAvatarStyle } from '@/lib/utils'

interface Props {
  userId: string | null
  isReferent: boolean
}

export function AnnouncementsSection({ userId, isReferent }: Props) {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', body: '', is_pinned: false })

  const load = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*, profiles!author_id(full_name, username, avatar_color)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setAnnouncements((data ?? []) as Announcement[])
    setLoading(false)
  }

  // Faux positif set-state-in-effect : les setState de load() sont après await.
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      return setError('Un titre et un contenu sont nécessaires.')
    }
    if (!userId) return
    setSaving(true)
    setError(null)

    const { error: insertErr } = await supabase.from('announcements').insert({
      author_id: userId,
      title: form.title.trim(),
      body: form.body.trim(),
      is_pinned: form.is_pinned,
    })

    if (insertErr) {
      setError('Publication impossible. Réessayez.')
      setSaving(false)
      return
    }

    setForm({ title: '', body: '', is_pinned: false })
    setCreating(false)
    setSaving(false)
    await load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id)
    await load()
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-content">
          <Megaphone size={18} className="text-brand-600" />
          Informations du lotissement
        </h2>
        {isReferent && !creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            <Plus size={15} /> Publier
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={handleSubmit}
          className="bg-surface border border-edge rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-content-soft">Nouvelle information</p>
            <button type="button" onClick={() => { setCreating(false); setError(null) }}
              className="text-content-faint hover:text-content-soft">
              <X size={16} />
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Ex : Coupure d'eau mardi 12 de 9h à 14h"
            className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={5}
            placeholder="Détail de l'information, consignes, contacts…"
            className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <label className="flex items-center gap-2 text-sm text-content-soft">
            <input type="checkbox" checked={form.is_pinned}
              onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
              className="rounded border-edge" />
            Épingler en haut de la liste
          </label>

          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Publication…</> : 'Publier'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-brand-600" size={24} />
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-10 text-content-faint bg-surface border border-edge rounded-2xl">
          <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Aucune information pour l&apos;instant</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map(a => (
            <article key={a.id}
              className={`bg-surface border rounded-2xl p-4 flex flex-col gap-2 ${a.is_pinned ? 'border-brand-300' : 'border-edge'}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-content flex items-center gap-2">
                  {a.is_pinned && <Pin size={14} className="text-brand-600 shrink-0" />}
                  {a.title}
                </h3>
                {isReferent && a.author_id === userId && (
                  <button onClick={() => handleDelete(a.id)}
                    className="text-content-faint hover:text-red-500 transition-colors shrink-0"
                    aria-label="Supprimer">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <p className="text-sm text-content-soft whitespace-pre-line leading-relaxed">{a.body}</p>

              <div className="flex items-center gap-2 text-xs text-content-faint pt-1">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={getAvatarStyle(a.profiles?.avatar_color)}
                >
                  {a.profiles?.full_name?.[0] || a.profiles?.username?.[0] || '?'}
                </span>
                {a.profiles?.full_name || a.profiles?.username || 'Référent'}
                <span>·</span>
                {formatDate(a.created_at)}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
