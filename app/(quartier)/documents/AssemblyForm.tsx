'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Assembly } from '@/lib/types'
import { todayIso } from '@/lib/documents'

interface Props {
  /** Assemblée à modifier — `null` en création */
  assembly: Assembly | null
  userId: string
  onClose: () => void
  onSaved: () => Promise<void> | void
}

/**
 * Création / modification d'une assemblée (titre + date de tenue).
 * Les fichiers se déposent ensuite, depuis la carte de l'assemblée.
 */
export function AssemblyForm({ assembly, userId, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [title, setTitle] = useState(assembly?.title ?? '')
  const [heldOn, setHeldOn] = useState(assembly?.held_on ?? todayIso())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('Un titre est nécessaire.')
    if (!heldOn) return setError('La date de l\'assemblée est nécessaire.')
    setSaving(true)
    setError(null)

    const values = { title: title.trim(), held_on: heldOn }

    // L'update conserve created_by : modifier l'assemblée d'un autre référent
    // ne se l'approprie pas (même règle que les informations du lotissement).
    const { error: saveErr } = assembly
      ? await supabase.from('assemblies')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', assembly.id)
      : await supabase.from('assemblies')
          .insert({ created_by: userId, ...values })

    if (saveErr) {
      setError(assembly ? 'Modification impossible. Réessayez.' : 'Création impossible. Réessayez.')
      setSaving(false)
      return
    }

    await onSaved()
    setSaving(false)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit}
      className="bg-surface border border-edge rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-content-soft">
          {assembly ? 'Modifier l\'assemblée' : 'Nouvelle assemblée'}
        </p>
        <button type="button" onClick={onClose} aria-label="Fermer"
          className="text-content-faint hover:text-content-soft">
          <X size={16} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <label className="flex flex-col gap-1 text-sm text-content-soft">
        Titre
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex : Assemblée générale 2026"
          className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm text-content focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-content-soft">
        Date de l&apos;assemblée
        <input
          type="date"
          value={heldOn}
          onChange={e => setHeldOn(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-edge bg-surface text-sm text-content focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </label>

      {!assembly && (
        <p className="text-xs text-content-faint">
          L&apos;ordre du jour, la présentation et le procès-verbal se déposent ensuite,
          depuis la carte de l&apos;assemblée.
        </p>
      )}

      <button type="submit" disabled={saving}
        className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
        {saving
          ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</>
          : assembly ? 'Enregistrer' : 'Créer l\'assemblée'}
      </button>
    </form>
  )
}
