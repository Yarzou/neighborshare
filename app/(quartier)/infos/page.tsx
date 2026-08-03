'use client'

import { Loader2 } from 'lucide-react'
import { useCurrentUser } from '@/lib/hooks'
import { LoginRequiredNotice } from '@/components/layout/LoginRequiredNotice'
import { AnnouncementsSection } from './AnnouncementsSection'
import { PollsSection } from './PollsSection'

/**
 * « Vie du quartier » — informations officielles de l'ASL et sondages.
 *
 * Les deux sections sont regroupées parce qu'elles ont la même origine : ce que
 * les référents adressent à l'ensemble du lotissement.
 */
export default function InfosPage() {
  const { userId, isReferent, resolved } = useCurrentUser()

  if (!resolved) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  return (
    <div className="pt-6 flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-content mb-1">Vie du quartier</h1>
        <p className="text-content-muted text-sm">
          Les informations officielles du lotissement et les consultations en cours.
        </p>
      </header>

      {!userId ? (
        <div className="bg-surface border border-edge rounded-2xl">
          <LoginRequiredNotice
            what="les informations du lotissement"
            redirectTo="/infos"
          />
        </div>
      ) : (
        <>
          <AnnouncementsSection userId={userId} isReferent={isReferent} />
          <div className="border-t border-edge" />
          <PollsSection userId={userId} isReferent={isReferent} />
        </>
      )}
    </div>
  )
}
