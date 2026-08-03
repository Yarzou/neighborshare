'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Plus, Loader2, X, Trash2, Users, CalendarDays, Pencil } from 'lucide-react'
import type { GroupPurchase } from '@/lib/types'
import { GROUP_PURCHASE_STATUS_LABELS, GROUP_PURCHASE_STATUS_COLORS } from '@/lib/types'
import { useCurrentUser } from '@/lib/hooks'
import { LoginRequiredNotice } from '@/components/layout/LoginRequiredNotice'
import { formatDate, getAvatarStyle, cn } from '@/lib/utils'

/** Quantité formatée sans décimales inutiles (500 plutôt que 500.00) */
function fmtQty(n: number): string {
  return Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2).replace('.', ',')
}

export default function GroupPurchasesPage() {
  const supabase = createClient()
  const { userId, isReferent, resolved } = useCurrentUser()

  const [purchases, setPurchases] = useState<GroupPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  /** id de l'achat en cours d'édition — le formulaire sert aux deux modes */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', unit: '', target_quantity: '', unit_price: '', deadline: '',
  })

  const startEdit = (p: GroupPurchase) => {
    setForm({
      title: p.title,
      description: p.description ?? '',
      unit: p.unit,
      target_quantity: p.target_quantity != null ? String(p.target_quantity) : '',
      unit_price: p.unit_price != null ? String(p.unit_price) : '',
      deadline: p.deadline ?? '',
    })
    setEditingId(p.id)
    setCreating(true)
    setError(null)
  }

  const closeForm = () => {
    setCreating(false)
    setEditingId(null)
    setForm({ title: '', description: '', unit: '', target_quantity: '', unit_price: '', deadline: '' })
    setError(null)
  }
  /** Saisie de quantité par achat (participation en cours d'édition) */
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({})

  const load = async () => {
    const { data } = await supabase
      .from('group_purchases')
      .select(`*,
        profiles!created_by(full_name, username, avatar_color),
        group_purchase_participants(*, profiles!user_id(full_name, username, avatar_color))`)
      .order('created_at', { ascending: false })
    setPurchases((data ?? []) as GroupPurchase[])
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.unit.trim()) {
      return setError('Le titre et l\'unité sont obligatoires.')
    }
    if (!userId) return

    setSaving(true)
    setError(null)

    const values = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      unit: form.unit.trim(),
      target_quantity: form.target_quantity ? parseFloat(form.target_quantity) : null,
      unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      deadline: form.deadline || null,
    }

    // Édition (créateur ou référent, policy 038) ou création. L'update conserve
    // created_by et le statut.
    const { error: saveErr } = editingId
      ? await supabase.from('group_purchases')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', editingId)
      : await supabase.from('group_purchases').insert({ created_by: userId, ...values })

    if (saveErr) {
      setError(editingId ? 'Modification impossible. Réessayez.' : 'Création impossible. Réessayez.')
      setSaving(false)
      return
    }

    closeForm()
    setSaving(false)
    await load()
  }

  const participate = async (purchaseId: string) => {
    if (!userId) return
    const qty = parseFloat((qtyInputs[purchaseId] ?? '').replace(',', '.'))
    if (!qty || qty <= 0) return setError('Indiquez une quantité valide.')

    setError(null)
    // PK (purchase_id, user_id) : re-participer met simplement la quantité à jour
    const { error: upsertErr } = await supabase
      .from('group_purchase_participants')
      .upsert(
        { purchase_id: purchaseId, user_id: userId, quantity: qty, updated_at: new Date().toISOString() },
        { onConflict: 'purchase_id,user_id' }
      )

    if (upsertErr) return setError('Participation impossible. Réessayez.')
    setQtyInputs(q => ({ ...q, [purchaseId]: '' }))
    await load()
  }

  const withdraw = async (purchaseId: string) => {
    if (!userId) return
    await supabase
      .from('group_purchase_participants')
      .delete()
      .eq('purchase_id', purchaseId)
      .eq('user_id', userId)
    await load()
  }

  const setStatus = async (purchaseId: string, status: 'ouvert' | 'cloture' | 'annule') => {
    await supabase
      .from('group_purchases')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', purchaseId)
    await load()
  }

  const handleDelete = async (purchaseId: string) => {
    await supabase.from('group_purchases').delete().eq('id', purchaseId)
    await load()
  }

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
            <ShoppingCart size={22} className="text-brand-600" />
            Achats groupés
          </h1>
          <p className="text-content-muted text-sm">
            Commandez à plusieurs — fioul, pellets, élagage… — pour obtenir un meilleur prix.
          </p>
        </div>
        {userId && !creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shrink-0">
            <Plus size={15} /> Proposer
          </button>
        )}
      </header>

      {!userId ? (
        <div className="bg-surface border border-edge rounded-2xl">
          <LoginRequiredNotice what="les achats groupés du quartier" redirectTo="/achats" />
        </div>
      ) : (
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}

          {creating && (
            <form onSubmit={handleCreate}
              className="bg-surface border border-edge rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-content-soft">
                  {editingId ? 'Modifier l\'achat groupé' : 'Nouvel achat groupé'}
                </p>
                <button type="button" onClick={closeForm}
                  className="text-content-faint hover:text-content-soft">
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">Titre *</label>
                <input name="title" value={form.title} onChange={handleChange}
                  placeholder="Ex : Commande groupée de fioul"
                  className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={2}
                  placeholder="Fournisseur pressenti, conditions, modalités de livraison…"
                  className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">Unité *</label>
                  <input name="unit" value={form.unit} onChange={handleChange}
                    placeholder="litres"
                    className="w-full px-3 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">Objectif</label>
                  <input name="target_quantity" value={form.target_quantity} onChange={handleChange}
                    type="number" min="0" step="any" placeholder="3000"
                    className="w-full px-3 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">Prix / unité (€)</label>
                  <input name="unit_price" value={form.unit_price} onChange={handleChange}
                    type="number" min="0" step="0.01" placeholder="1.05"
                    className="w-full px-3 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">Date limite</label>
                  <input name="deadline" value={form.deadline} onChange={handleChange}
                    type="date" min={new Date().toISOString().slice(0, 10)}
                    className="w-full px-3 py-2.5 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> {editingId ? 'Enregistrement…' : 'Création…'}</>
                  : editingId ? 'Enregistrer' : 'Proposer l\'achat groupé'}
              </button>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-brand-600" size={28} />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-16 text-content-faint bg-surface border border-edge rounded-2xl">
              <ShoppingCart size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun achat groupé en cours</p>
              <p className="text-xs mt-1">Proposez le premier — fioul, pellets, élagage…</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {purchases.map(p => {
                const participants = p.group_purchase_participants ?? []
                const total = participants.reduce((sum, x) => sum + Number(x.quantity), 0)
                const pct = p.target_quantity
                  ? Math.min(100, Math.round((total / Number(p.target_quantity)) * 100))
                  : null
                const mine = participants.find(x => x.user_id === userId)
                const isOwner = p.created_by === userId
                // Créateur ou référent : modifier, supprimer, gérer le statut (policy 038)
                const canManage = isOwner || isReferent
                const deadlinePassed = Boolean(p.deadline && p.deadline < new Date().toISOString().slice(0, 10))
                const isOpen = p.status === 'ouvert' && !deadlinePassed

                return (
                  <article key={p.id}
                    className="bg-surface border border-edge rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-content">{p.title}</h2>
                        {p.description && (
                          <p className="text-sm text-content-muted mt-1 whitespace-pre-line">{p.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                          deadlinePassed && p.status === 'ouvert'
                            ? 'bg-gray-200 text-gray-500'
                            : GROUP_PURCHASE_STATUS_COLORS[p.status])}>
                          {deadlinePassed && p.status === 'ouvert' ? 'Échu' : GROUP_PURCHASE_STATUS_LABELS[p.status]}
                        </span>
                        {canManage && (
                          <span className="flex items-center gap-2">
                            <button onClick={() => startEdit(p)}
                              className="text-content-faint hover:text-brand-600 transition-colors"
                              aria-label="Modifier">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => handleDelete(p.id)}
                              className="text-content-faint hover:text-red-500 transition-colors"
                              aria-label="Supprimer">
                              <Trash2 size={15} />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progression */}
                    <div className="flex flex-col gap-1.5">
                      {pct !== null && (
                        <div className="h-2.5 rounded-full bg-surface-sunken overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all',
                              pct >= 100 ? 'bg-brand-600' : 'bg-brand-400')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted">
                        <span className="font-medium text-content-soft tabular-nums">
                          {fmtQty(total)}{p.target_quantity ? ` / ${fmtQty(Number(p.target_quantity))}` : ''} {p.unit}
                          {pct !== null && ` · ${pct}%`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {participants.length} foyer{participants.length > 1 ? 's' : ''}
                        </span>
                        {p.unit_price != null && (
                          <span>{Number(p.unit_price).toFixed(2).replace('.', ',')} € / {p.unit}</span>
                        )}
                        {p.deadline && (
                          <span className="flex items-center gap-1">
                            <CalendarDays size={12} /> jusqu&apos;au {formatDate(p.deadline)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ma participation */}
                    {isOpen && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          value={qtyInputs[p.id] ?? ''}
                          onChange={e => setQtyInputs(q => ({ ...q, [p.id]: e.target.value }))}
                          type="number" min="0" step="any"
                          placeholder={mine ? `Actuellement : ${fmtQty(Number(mine.quantity))}` : `Quantité en ${p.unit}`}
                          className="flex-1 px-3 py-2 rounded-xl border border-edge bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button onClick={() => participate(p.id)}
                          className="px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shrink-0">
                          {mine ? 'Modifier' : 'Je participe'}
                        </button>
                        {mine && (
                          <button onClick={() => withdraw(p.id)}
                            className="px-3 py-2 rounded-xl border border-edge text-content-muted text-sm hover:text-red-500 hover:border-red-300 transition-colors shrink-0">
                            Me retirer
                          </button>
                        )}
                      </div>
                    )}

                    {/* Participants */}
                    {participants.length > 0 && (
                      <div className="flex flex-col gap-1 pt-1 border-t border-edge">
                        {participants.map(x => (
                          <div key={x.user_id}
                            className="flex items-center justify-between text-xs text-content-muted pt-1.5">
                            <span className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={getAvatarStyle(x.profiles?.avatar_color)}
                              >
                                {x.profiles?.full_name?.[0] || x.profiles?.username?.[0] || '?'}
                              </span>
                              {x.profiles?.full_name || x.profiles?.username || 'Voisin'}
                              {x.user_id === userId && ' (vous)'}
                            </span>
                            <span className="tabular-nums font-medium text-content-soft">
                              {fmtQty(Number(x.quantity))} {p.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Gestion du statut (créateur ou référent) */}
                    {canManage && p.status === 'ouvert' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => setStatus(p.id, 'cloture')}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-edge text-content-muted hover:border-brand-300 hover:text-brand-700 transition-colors">
                          Clôturer
                        </button>
                        <button onClick={() => setStatus(p.id, 'annule')}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-edge text-content-muted hover:border-red-300 hover:text-red-500 transition-colors">
                          Annuler
                        </button>
                      </div>
                    )}
                    {canManage && p.status !== 'ouvert' && (
                      <button onClick={() => setStatus(p.id, 'ouvert')}
                        className="self-start text-xs px-2.5 py-1.5 rounded-lg border border-edge text-content-muted hover:border-brand-300 hover:text-brand-700 transition-colors">
                        Rouvrir
                      </button>
                    )}

                    <div className="flex items-center gap-2 text-xs text-content-faint">
                      Proposé par {p.profiles?.full_name || p.profiles?.username || 'un voisin'}
                      <span>·</span>
                      {formatDate(p.created_at)}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
