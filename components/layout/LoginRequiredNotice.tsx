'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'

interface Props {
  /** Ce que l'utilisateur verrait s'il était connecté — ex. « les annonces de votre quartier » */
  what: string
  /** Chemin de retour après connexion */
  redirectTo: string
  className?: string
  /**
   * Masque les boutons pour ne garder que le message.
   * À utiliser quand un autre encart porte déjà l'appel à l'action au même écran
   * (cas de la page carte en desktop : liste + voile sur la carte).
   */
  compact?: boolean
}

/**
 * Encart affiché à la place d'une liste vide quand le visiteur n'est pas connecté.
 *
 * Depuis la migration 030, la lecture de `listings`, `profiles` et `events` est
 * réservée aux comptes authentifiés : sans ce message, un visiteur déconnecté
 * verrait « Aucune annonce » et croirait le quartier vide.
 */
export function LoginRequiredNotice({ what, redirectTo, className, compact = false }: Props) {
  return (
    <div className={className ?? 'text-center py-16 px-4 text-gray-500'}>
      <Lock size={compact ? 28 : 36} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium text-gray-700">Réservé aux voisins</p>
      <p className="text-sm mt-1 max-w-xs mx-auto">
        Connectez-vous pour voir {what}.
      </p>
      <div className={`flex items-center justify-center gap-2 mt-4 ${compact ? 'hidden' : ''}`}>
        <Link
          href={`/auth/login?redirect=${encodeURIComponent(redirectTo)}`}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Se connecter
        </Link>
        <Link
          href="/auth/register"
          className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:border-brand-300 transition-colors"
        >
          Créer un compte
        </Link>
      </div>
    </div>
  )
}
