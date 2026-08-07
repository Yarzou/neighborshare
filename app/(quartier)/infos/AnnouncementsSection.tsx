'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Pin, Plus, Loader2, X, AlertCircle } from 'lucide-react'
import type { Announcement } from '@/lib/types'
import { formatDate, getAvatarStyle } from '@/lib/utils'
import { notifyQuartier } from '@/lib/pushNotifications'
import { ItemActions } from '@/components/common/ItemActions'

interface Props {
  userId: string | null
  isReferent: boolean
}

export function AnnouncementsSection({ userId, isReferent }: Props) {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  /** id de l'annonce en cours d'édition — le formulaire sert aux deux modes */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Échec de suppression — distinct de `error`, qui appartient au formulaire. */
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', body: '', is_pinned: false })

  const startEdit = (a: Announcement) => {
    setForm({ title: a.title, body: a.body, is_pinned: a.is_pinned })
    setEditingId(a.id)
    setCreating(true)
    setError(null)
  }

  const closeForm = () => {
    setCreating(false)
    setEditingId(null)
    setForm({ title: '', body: '', is_pinned: false })
    setError(null)
  }

  const load = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*, profiles!author_id(full_name, username, avatar_color)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      // Borne défensive : la liste n'est pas paginée. Les plus anciennes infos
      // n'intéressent personne, mais elles seraient transférées à chaque visite.
      .limit(100)
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

    const values = {
      title: form.title.trim(),
      body: form.body.trim(),
      is_pinned: form.is_pinned,
    }

    // Édition (tout référent, policy 038) ou création. L'update conserve
    // author_id : modifier l'annonce d'un autre référent ne se l'approprie pas.
    const { data: created, error: saveErr } = editingId
      ? await supabase.from('announcements')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .select('id')
          .single()
      : await supabase.from('announcements')
          .insert({ author_id: userId, ...values })
          .select('id')
          .single()

    if (saveErr) {
      setError(editingId ? 'Modification impossible. Réessayez.' : 'Publication impossible. Réessayez.')
      setSaving(false)
      return
    }

    // Push à tout le quartier — à la création seulement, jamais à l'édition
    if (!editingId && created) notifyQuartier('new_announcement', created.id)

    closeForm()
    setSaving(false)
    await load()
  }

  // `.select('id')` obligatoire : un delete refusé par RLS ne renvoie pas
  // d'erreur, seulement zéro ligne. Sans ce contrôle l'écran affiche un succès
  // et l'information réapparaît au rechargement.
  const handleDelete = async (id: string): Promise<boolean> => {
    const { data } = await supabase.from('announcements').delete().eq('id', id).select('id')
    await load()
    return (data?.length ?? 0) > 0
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
            <p className="text-sm font-semibold text-content-soft">
              {editingId ? 'Modifier l\'information' : 'Nouvelle information'}
            </p>
            <button type="button" onClick={closeForm}
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
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> {editingId ? 'Enregistrement…' : 'Publication…'}</>
              : editingId ? 'Enregistrer' : 'Publier'}
          </button>
        </form>
      )}

      {deleteError && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={14} className="shrink-0" /> {deleteError}
        </p>
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
                {/* Tout référent gère toutes les annonces (policy 038), pas seulement les siennes.
                    Géométrie portée par ItemActions (44 × 44 px, sans recouvrement) ; `-my-3`
                    annule la hauteur ajoutée par le padding (la rangée reste à la hauteur du
                    titre) et `-mr-3` récupère de la largeur sur le `p-4` de la carte. */}
                {isReferent && (
                  <ItemActions
                    className="-my-3 -mr-3"
                    onEdit={() => startEdit(a)}
                    onDelete={() => handleDelete(a.id)}
                    onFailure={() => setDeleteError('Suppression impossible. Réessayez.')}
                  />
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
