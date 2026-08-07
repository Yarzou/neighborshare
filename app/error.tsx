'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

/**
 * Frontière d'erreur de l'application. Obligatoirement un composant client :
 * c'est React qui l'appelle au moment où un rendu échoue.
 *
 * Sans elle, une erreur dans un Server Component remplaçait la page entière par
 * l'écran par défaut de Next, sans possibilité de réessayer.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[erreur de rendu]', error)
  }, [error])

  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center flex flex-col items-center gap-4">
      <AlertTriangle size={48} className="text-amber-500" />
      <h1 className="text-2xl font-bold text-content">Une erreur est survenue</h1>
      <p className="text-sm text-content-soft">
        La page n&apos;a pas pu s&apos;afficher. Vous pouvez réessayer — si le problème
        persiste, revenez plus tard.
      </p>
      {error.digest && (
        <p className="text-xs text-content-faint font-mono">Référence : {error.digest}</p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
        >
          Réessayer
        </button>
        <Link
          href="/accueil"
          className="px-5 py-2.5 rounded-xl border border-edge text-content text-sm font-semibold hover:bg-surface-sunken transition-colors"
        >
          Accueil
        </Link>
      </div>
    </div>
  )
}
