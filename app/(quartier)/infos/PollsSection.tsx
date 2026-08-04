'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Vote, Plus, Loader2, X, Trash2, Check, Pencil } from 'lucide-react'
import type { Poll, PollResult } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { notifyQuartier } from '@/lib/pushNotifications'

interface Props {
  userId: string | null
  isReferent: boolean
}

/** État de vote et résultats, par sondage */
interface PollState {
  myOptionId: string | null
  results: PollResult[] | null
}

export function PollsSection({ userId, isReferent }: Props) {
  const supabase = createClient()
  const [polls, setPolls] = useState<Poll[]>([])
  const [states, setStates] = useState<Record<string, PollState>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  /** id du sondage en cours d'édition — seules les métadonnées sont éditables,
   *  pas les options : modifier les réponses d'un sondage déjà voté corromprait le vote. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ question: '', description: '', closes_at: '' })
  const [options, setOptions] = useState<string[]>(['', ''])

  const startEdit = (p: Poll) => {
    setForm({ question: p.question, description: p.description ?? '', closes_at: p.closes_at ?? '' })
    setEditingId(p.id)
    setCreating(true)
    setError(null)
  }

  const closeForm = () => {
    setCreating(false)
    setEditingId(null)
    setForm({ question: '', description: '', closes_at: '' })
    setOptions(['', ''])
    setError(null)
  }

  /** Résultats : le RPC lève une exception si l'utilisateur n'a pas encore voté. */
  const loadResults = async (pollId: string) => {
    const { data, error: rpcErr } = await supabase.rpc('poll_results', { p_poll_id: pollId })
    return rpcErr ? null : (data as PollResult[])
  }

  const load = async () => {
    const { data } = await supabase
      .from('polls')
      .select('*, poll_options(*)')
      .order('created_at', { ascending: false })

    const list = (data ?? []) as Poll[]
    list.forEach(p => p.poll_options?.sort((a, b) => a.position - b.position))
    setPolls(list)

    if (userId && list.length > 0) {
      const { data: myVotes } = await supabase
        .from('poll_votes')
        .select('poll_id, option_id')

      const voteByPoll = new Map((myVotes ?? []).map(v => [v.poll_id, v.option_id]))
      const entries = await Promise.all(
        list.map(async p => {
          const myOptionId = voteByPoll.get(p.id) ?? null
          const results = await loadResults(p.id)
          return [p.id, { myOptionId, results }] as const
        })
      )
      setStates(Object.fromEntries(entries))
    }
    setLoading(false)
  }

  // Faux positif set-state-in-effect : les setState de load() sont après await.
  useEffect(() => { load() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  const vote = async (pollId: string, optionId: string) => {
    if (!userId) return
    // Une seule voix par compte : PK (poll_id, user_id), donc changer d'avis = upsert
    const { error: voteErr } = await supabase
      .from('poll_votes')
      .upsert({ poll_id: pollId, option_id: optionId, user_id: userId }, { onConflict: 'poll_id,user_id' })

    if (voteErr) {
      setError('Vote impossible. Réessayez.')
      return
    }
    const results = await loadResults(pollId)
    setStates(s => ({ ...s, [pollId]: { myOptionId: optionId, results } }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const labels = options.map(o => o.trim()).filter(Boolean)
    if (!form.question.trim()) return setError('La question est obligatoire.')
    if (!editingId && labels.length < 2) return setError('Il faut au moins deux réponses possibles.')
    if (!userId) return

    setSaving(true)
    setError(null)

    // Édition : métadonnées uniquement (tout référent, policy 038)
    if (editingId) {
      const { error: updErr } = await supabase
        .from('polls')
        .update({
          question: form.question.trim(),
          description: form.description.trim() || null,
          closes_at: form.closes_at || null,
        })
        .eq('id', editingId)

      if (updErr) {
        setError('Modification impossible. Réessayez.')
        setSaving(false)
        return
      }
      closeForm()
      setSaving(false)
      await load()
      return
    }

    const { data: poll, error: pollErr } = await supabase
      .from('polls')
      .insert({
        created_by: userId,
        question: form.question.trim(),
        description: form.description.trim() || null,
        closes_at: form.closes_at || null,
      })
      .select()
      .single()

    if (pollErr || !poll) {
      setError('Création impossible. Réessayez.')
      setSaving(false)
      return
    }

    const { error: optErr } = await supabase.from('poll_options').insert(
      labels.map((label, i) => ({ poll_id: poll.id, label, position: i }))
    )

    if (optErr) {
      // Sondage sans option = inutilisable : on nettoie plutôt que de le laisser en base
      await supabase.from('polls').delete().eq('id', poll.id)
      setError('Création impossible. Réessayez.')
      setSaving(false)
      return
    }

    // Push à tout le quartier (fire-and-forget)
    notifyQuartier('new_poll', poll.id)

    closeForm()
    setSaving(false)
    await load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('polls').delete().eq('id', id)
    await load()
  }

  const isClosed = (p: Poll) => Boolean(p.closes_at && p.closes_at < new Date().toISOString().slice(0, 10))

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-content">
          <Vote size={18} className="text-brand-600" />
          Sondages
        </h2>
        {isReferent && !creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            <Plus size={15} /> Nouveau sondage
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={handleCreate}
          className="bg-surface border border-edge rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-content-soft">
              {editingId ? 'Modifier le sondage' : 'Nouveau sondage'}
            </p>
            <button type="button" onClick={closeForm}
              className="text-content-faint hover:text-content-soft">
              <X size={16} />
            </button>
          </div>

          {editingId && (
            <p className="text-xs text-content-faint">
              Les réponses possibles ne sont pas modifiables : des voisins ont pu déjà voter.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <input
            value={form.question}
            onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
            placeholder="Ex : Quel prestataire pour l'élagage ?"
            className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="Précisions (optionnel)"
            className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          {!editingId && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-content-muted">Réponses possibles</p>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={e => setOptions(o => o.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={`Réponse ${i + 1}`}
                  className="flex-1 px-4 py-2 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => setOptions(o => o.filter((_, j) => j !== i))}
                    className="text-content-faint hover:text-red-500">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setOptions(o => [...o, ''])}
              className="self-start text-sm text-brand-600 hover:underline">
              + Ajouter une réponse
            </button>
          </div>
          )}

          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">
              Clôture <span className="font-normal">(optionnel)</span>
            </label>
            <input type="date" value={form.closes_at}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setForm(f => ({ ...f, closes_at: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> {editingId ? 'Enregistrement…' : 'Création…'}</>
              : editingId ? 'Enregistrer' : 'Créer le sondage'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-brand-600" size={24} />
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-10 text-content-faint bg-surface border border-edge rounded-2xl">
          <Vote size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Aucun sondage en cours</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {polls.map(p => {
            const state = states[p.id]
            const hasVoted = Boolean(state?.myOptionId)
            const closed = isClosed(p)
            const results = state?.results
            const total = results?.reduce((sum, r) => sum + Number(r.votes), 0) ?? 0

            return (
              <article key={p.id} className="bg-surface border border-edge rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-content">{p.question}</h3>
                    {p.description && (
                      <p className="text-sm text-content-muted mt-1">{p.description}</p>
                    )}
                  </div>
                  {/* Tout référent gère tous les sondages (policy 038), pas seulement les siens.
                      Cibles tactiles de 44 × 44 px, icônes à 15 px ; `-my-3` annule la hauteur
                      ajoutée par le padding, `-mr-3` récupère de la largeur sur le `p-4`.
                      Boutons jointifs sans recouvrement : `supprimer` est destructif. */}
                  {isReferent && (
                    <span className="flex items-center shrink-0 -my-3 -mr-3">
                      <button onClick={() => startEdit(p)}
                        className="w-11 h-11 flex items-center justify-center rounded-xl text-content-faint hover:text-brand-600 hover:bg-surface-sunken transition-colors"
                        aria-label="Modifier">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        className="w-11 h-11 flex items-center justify-center rounded-xl text-content-faint hover:text-red-500 hover:bg-surface-sunken transition-colors"
                        aria-label="Supprimer">
                        <Trash2 size={15} />
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {p.poll_options?.map(opt => {
                    const result = results?.find(r => r.option_id === opt.id)
                    const votes = Number(result?.votes ?? 0)
                    const pct = total > 0 ? Math.round((votes / total) * 100) : 0
                    const mine = state?.myOptionId === opt.id

                    return (
                      <button
                        key={opt.id}
                        onClick={() => !closed && vote(p.id, opt.id)}
                        disabled={closed}
                        className={`relative overflow-hidden text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                          mine ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-edge hover:border-brand-300 text-content-soft'
                        } ${closed ? 'cursor-default' : ''}`}
                      >
                        {/* Barre de résultat, seulement quand les résultats sont accessibles */}
                        {results && (
                          <span
                            className="absolute inset-y-0 left-0 bg-brand-100/60"
                            style={{ width: `${pct}%` }}
                            aria-hidden
                          />
                        )}
                        <span className="relative flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            {mine && <Check size={14} className="text-brand-600" />}
                            {opt.label}
                          </span>
                          {results && (
                            <span className="text-xs font-medium tabular-nums">
                              {votes} · {pct}%
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <p className="text-xs text-content-faint">
                  {closed
                    ? `Clos le ${formatDate(p.closes_at!)}`
                    : hasVoted
                      ? `${total} vote${total > 1 ? 's' : ''}${p.closes_at ? ` · clôture le ${formatDate(p.closes_at)}` : ''}`
                      : 'Votez pour voir les résultats'}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
