'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wrench, Plus, Loader2, X, Trash2, Phone, Mail, Globe, Search, Pencil } from 'lucide-react'
import type { Provider } from '@/lib/types'
import { useCurrentUser } from '@/lib/hooks'
import { LoginRequiredNotice } from '@/components/layout/LoginRequiredNotice'
import { notifyQuartier } from '@/lib/pushNotifications'
import { formatDate, normalizeSearch, getAvatarStyle } from '@/lib/utils'

export default function ProvidersPage() {
  const supabase = createClient()
  const { userId, isReferent, resolved } = useCurrentUser()

  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  /** id de la fiche en cours d'édition — le formulaire sert aux deux modes */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', trade: '', phone: '', email: '', website: '', comment: '',
  })

  const startEdit = (p: Provider) => {
    setForm({
      name: p.name, trade: p.trade,
      phone: p.phone ?? '', email: p.email ?? '',
      website: p.website ?? '', comment: p.comment ?? '',
    })
    setEditingId(p.id)
    setCreating(true)
    setError(null)
  }

  const closeForm = () => {
    setCreating(false)
    setEditingId(null)
    setForm({ name: '', trade: '', phone: '', email: '', website: '', comment: '' })
    setError(null)
  }

  const load = async () => {
    const { data } = await supabase
      .from('providers')
      .select('*, profiles!created_by(full_name, username, avatar_color)')
      .order('trade', { ascending: true })
      .order('created_at', { ascending: false })
    setProviders((data ?? []) as Provider[])
    setLoading(false)
  }

  // Pas de setLoading(false) pour le cas déconnecté : le rendu court-circuite
  // sur !userId avant de consulter `loading`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- faux positif : les setState de load() sont après await
    if (resolved && userId) load()
  }, [resolved, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.trade.trim()) {
      return setError('Le nom et le métier sont obligatoires.')
    }
    if (!userId) return

    setSaving(true)
    setError(null)

    const values = {
      name: form.name.trim(),
      trade: form.trade.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      comment: form.comment.trim() || null,
    }

    // Édition (créateur ou référent, policy 038) ou création. L'update conserve
    // created_by : la fiche reste attribuée à celui qui l'a recommandée.
    const { data: created, error: saveErr } = editingId
      ? await supabase.from('providers')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .select('id')
          .single()
      : await supabase.from('providers')
          .insert({ created_by: userId, ...values })
          .select('id')
          .single()

    if (saveErr) {
      setError('Enregistrement impossible. Réessayez.')
      setSaving(false)
      return
    }

    // Push à tout le quartier — à la création seulement, jamais à l'édition
    if (!editingId && created) notifyQuartier('new_provider', created.id)

    closeForm()
    setSaving(false)
    await load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('providers').delete().eq('id', id)
    await load()
  }

  const filtered = search.trim()
    ? providers.filter(p => {
        const term = normalizeSearch(search.trim())
        return (
          normalizeSearch(p.name).includes(term) ||
          normalizeSearch(p.trade).includes(term) ||
          normalizeSearch(p.comment ?? '').includes(term)
        )
      })
    : providers

  if (!resolved) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  return (
    <div className="pt-6 flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content mb-1 flex items-center gap-2">
            <Wrench size={22} className="text-brand-600" />
            Prestataires
          </h1>
          <p className="text-content-muted text-sm">
            Les artisans et entreprises recommandés par vos voisins.
          </p>
        </div>
        {userId && !creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shrink-0">
            <Plus size={15} /> Ajouter
          </button>
        )}
      </header>

      {!userId ? (
        <div className="bg-surface border border-edge rounded-2xl">
          <LoginRequiredNotice what="les prestataires recommandés" redirectTo="/prestataires" />
        </div>
      ) : (
        <>
          {creating && (
            <form onSubmit={handleSubmit}
              className="bg-surface border border-edge rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-content-soft">
                  {editingId ? 'Modifier le prestataire' : 'Nouveau prestataire'}
                </p>
                <button type="button" onClick={closeForm}
                  className="text-content-faint hover:text-content-soft">
                  <X size={16} />
                </button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">Nom *</label>
                  <input name="name" value={form.name} onChange={handleChange}
                    placeholder="Ex : Plomberie Martin"
                    className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">Métier *</label>
                  <input name="trade" value={form.trade} onChange={handleChange}
                    placeholder="Ex : Plombier"
                    className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">Téléphone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} type="tel"
                    placeholder="06 12 34 56 78"
                    className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">Email</label>
                  <input name="email" value={form.email} onChange={handleChange} type="email"
                    placeholder="contact@exemple.fr"
                    className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">Site web</label>
                <input name="website" value={form.website} onChange={handleChange}
                  placeholder="https://…"
                  className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">
                  Votre retour d&apos;expérience
                </label>
                <textarea name="comment" value={form.comment} onChange={handleChange} rows={3}
                  placeholder="Ex : intervenu rapidement pour une fuite, tarif correct, travail soigné."
                  className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</>
                  : editingId ? 'Enregistrer' : 'Ajouter le prestataire'}
              </button>
            </form>
          )}

          {providers.length > 0 && (
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-content-faint pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un métier, un nom…"
                className="w-full pl-8 pr-3 py-2 rounded-full text-sm border border-edge bg-surface-sunken focus:outline-none focus:border-brand-400"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 text-content-faint hover:text-content-soft">
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-brand-600" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-content-faint bg-surface border border-edge rounded-2xl">
              <Wrench size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">
                {providers.length === 0 ? 'Aucun prestataire pour l\'instant' : 'Aucun résultat'}
              </p>
              {providers.length === 0 && (
                <p className="text-xs mt-1">Partagez un artisan qui vous a donné satisfaction.</p>
              )}
            </div>
          ) : (
            /* Pile sur mobile, deux colonnes à partir de md: — le conteneur du
               layout (quartier) plafonne à max-w-2xl, donc `sm:` donnerait des
               colonnes trop étroites pour les pastilles de contact.
               `items-start` : chaque card garde sa hauteur propre. */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {filtered.map(p => (
                <article key={p.id}
                  className="bg-surface border border-edge rounded-2xl p-4 flex flex-col gap-3 transition-colors hover:border-brand-300">
                  <div className="flex items-start gap-3">
                    {/* Ancre visuelle : l'équivalent de la vignette d'un événement,
                        qu'une fiche prestataire ne peut pas avoir (pas d'image). */}
                    <span className="shrink-0 w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                      <Wrench size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-content leading-tight break-words">{p.name}</h2>
                      {/* `rounded-md` et pas `rounded-full` : `trade` est saisi
                          librement, un métier long (« Chauffage climatisation
                          ventilation ») passe sur 2 ou 3 lignes et une pastille
                          en forme de stade devient illisible. Pas de `truncate`
                          non plus — le métier est ce sur quoi on cherche. */}
                      <span className="inline-flex mt-1 px-2 py-0.5 rounded-md bg-surface-sunken text-xs font-medium text-brand-700">
                        {p.trade}
                      </span>
                    </div>
                    {/* Créateur ou référent : modifier et supprimer (policy 038) */}
                    {(p.created_by === userId || isReferent) && (
                      <span className="flex items-center shrink-0 -mt-1.5 -mr-1.5">
                        <button onClick={() => startEdit(p)}
                          className="p-2 rounded-lg text-content-faint hover:text-brand-600 hover:bg-surface-sunken transition-colors"
                          aria-label="Modifier">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          className="p-2 rounded-lg text-content-faint hover:text-red-500 hover:bg-surface-sunken transition-colors"
                          aria-label="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    )}
                  </div>

                  {/* Pas de line-clamp : il n'existe pas de page de détail
                      prestataire, tronquer rendrait le retour d'expérience
                      définitivement inatteignable. */}
                  {p.comment && (
                    <p className="text-sm text-content-soft leading-relaxed">{p.comment}</p>
                  )}

                  {(p.phone || p.email || p.website) && (
                    <div className="flex flex-wrap gap-2">
                      {p.phone && (
                        <a href={`tel:${p.phone.replace(/\s/g, '')}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-edge bg-surface-sunken text-sm text-brand-700 whitespace-nowrap hover:border-brand-300 transition-colors">
                          <Phone size={14} className="shrink-0" /> {p.phone}
                        </a>
                      )}
                      {p.email && (
                        <a href={`mailto:${p.email}`}
                          className="inline-flex items-center gap-1.5 min-w-0 max-w-full px-3 py-2 rounded-xl border border-edge bg-surface-sunken text-sm text-brand-700 hover:border-brand-300 transition-colors">
                          <Mail size={14} className="shrink-0" />
                          <span className="truncate">{p.email}</span>
                        </a>
                      )}
                      {p.website && (
                        <a href={p.website} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-edge bg-surface-sunken text-sm text-brand-700 hover:border-brand-300 transition-colors">
                          <Globe size={14} className="shrink-0" /> Site
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-content-faint border-t border-edge pt-2.5">
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={getAvatarStyle(p.profiles?.avatar_color)}
                    >
                      {p.profiles?.full_name?.[0] || p.profiles?.username?.[0] || '?'}
                    </span>
                    <span className="truncate">
                      Recommandé par {p.profiles?.full_name || p.profiles?.username || 'un voisin'}
                    </span>
                    <span className="shrink-0">· {formatDate(p.created_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
