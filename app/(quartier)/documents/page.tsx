'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Loader2, AlertCircle, ScrollText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Assembly } from '@/lib/types'
import { useCurrentUser } from '@/lib/hooks'
import { LoginRequiredNotice } from '@/components/layout/LoginRequiredNotice'
import { hasMinutes, heldOnYear } from '@/lib/documents'
import { AssemblyForm } from './AssemblyForm'
import { AssemblyCard } from './AssemblyCard'

/**
 * « Documents » — assemblées générales du lotissement et leurs fichiers.
 *
 * Deux zones : les assemblées à venir (ordre du jour, présentation) en tête, puis
 * l'historique des procès-verbaux groupé par année. Une assemblée bascule dans
 * l'historique dès que son PV est publié.
 *
 * Dégradation silencieuse : si la migration 040 n'est pas encore passée sur la
 * base, la requête échoue et la page s'affiche vide (même règle que /infos).
 */
export default function DocumentsPage() {
  const supabase = createClient()
  const { userId, isReferent, resolved } = useCurrentUser()

  const [assemblies, setAssemblies] = useState<Assembly[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Assembly | null>(null)
  /** Échec hors formulaire (téléchargement, suppression) */
  const [actionError, setActionError] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('assemblies')
      .select('*, assembly_documents(*)')
      .order('held_on', { ascending: false })
      .limit(200)
    setAssemblies((data ?? []) as Assembly[])
    setLoading(false)
  }

  // La table est réservée aux comptes connectés : inutile d'interroger avant
  // que l'auth soit résolue. Faux positif set-state-in-effect : les setState de
  // load() sont après await.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resolved && userId) load()
  }, [resolved, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = useMemo(
    () => assemblies.filter(a => !hasMinutes(a)).sort((a, b) => a.held_on.localeCompare(b.held_on)),
    [assemblies],
  )

  /** Assemblées archivées groupées par année, de la plus récente à la plus ancienne */
  const archivedByYear = useMemo(() => {
    const groups = new Map<number, Assembly[]>()
    for (const a of assemblies) {
      if (!hasMinutes(a)) continue
      const year = heldOnYear(a.held_on)
      groups.set(year, [...(groups.get(year) ?? []), a])
    }
    return Array.from(groups.entries()).sort((x, y) => y[0] - x[0])
  }, [assemblies])

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (a: Assembly) => { setEditing(a); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditing(null) }

  if (!resolved) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  return (
    <div className="pt-6 flex flex-col gap-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content mb-1">Documents ASL</h1>
          <p className="text-content-muted text-sm">
            Ordres du jour, présentations et procès-verbaux des assemblées générales.
          </p>
        </div>
        {userId && isReferent && !formOpen && (
          <button onClick={openCreate}
            className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            <Plus size={15} /> <span className="hidden sm:inline">Nouvelle assemblée</span><span className="sm:hidden">Assemblée</span>
          </button>
        )}
      </header>

      {!userId ? (
        <div className="bg-surface border border-edge rounded-2xl">
          <LoginRequiredNotice what="les documents du lotissement" redirectTo="/documents" />
        </div>
      ) : (
        <>
          {formOpen && (
            <AssemblyForm assembly={editing} userId={userId} onClose={closeForm} onSaved={load} />
          )}

          {actionError && (
            <p className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" /> {actionError}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin text-brand-600" size={24} />
            </div>
          ) : assemblies.length === 0 ? (
            <div className="text-center py-10 text-content-faint bg-surface border border-edge rounded-2xl">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Aucun document pour l&apos;instant</p>
              {isReferent && (
                <p className="text-xs mt-1">Créez une assemblée pour y déposer ses fichiers.</p>
              )}
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="flex items-center gap-2 text-base font-bold text-content">
                    <FileText size={18} className="text-brand-600" />
                    {upcoming.length > 1 ? 'Prochaines assemblées' : 'Prochaine assemblée'}
                  </h2>
                  {upcoming.map(a => (
                    <AssemblyCard key={a.id} assembly={a} userId={userId} isReferent={isReferent}
                      onChanged={load} onEdit={openEdit} onError={setActionError} />
                  ))}
                </section>
              )}

              <section className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-content">
                  <ScrollText size={18} className="text-brand-600" />
                  Procès-verbaux
                </h2>
                {archivedByYear.length === 0 ? (
                  <p className="text-sm text-content-faint">
                    Aucun procès-verbal publié pour l&apos;instant.
                  </p>
                ) : archivedByYear.map(([year, list]) => (
                  <div key={year} className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-content-faint">{year}</h3>
                    {list.map(a => (
                      <AssemblyCard key={a.id} assembly={a} userId={userId} isReferent={isReferent}
                        onChanged={load} onEdit={openEdit} onError={setActionError} />
                    ))}
                  </div>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
