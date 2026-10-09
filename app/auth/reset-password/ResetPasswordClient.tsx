'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle, Loader2, Lock } from 'lucide-react'

/**
 * Formulaire d'arrivée du lien « mot de passe oublié ».
 * Le token est dans l'URL (`token_hash`) et n'est consommé qu'à la soumission,
 * par POST /api/auth/reset-password qui valide puis change le mot de passe dans
 * la même requête. Pas de session tant que ce n'est pas fait.
 */
export default function ResetPasswordClient() {
  const searchParams = useSearchParams()
  // Peut être remplacé par un token neuf renvoyé par la route quand Supabase
  // refuse le mot de passe (identique à l'ancien, trop faible) : le premier
  // token est consommé par la tentative, la resoumission en a besoin d'un autre.
  const [tokenHash, setTokenHash] = useState(() => searchParams.get('token_hash'))

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkDead, setLinkDead] = useState(!tokenHash)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, password }),
      })
      const json = (await res.json().catch(() => null)) as
        | { error?: string; code?: string; token_hash?: string }
        | null
      if (!res.ok) {
        if (json?.token_hash) {
          // Mot de passe refusé mais token de rechange fourni : on resoumet avec.
          setTokenHash(json.token_hash)
          setError(json.error ?? 'Mot de passe refusé. Essayez-en un autre.')
        } else if (json?.code) {
          // invalid_link, ou refus après validation sans rechange : le token est
          // consommé, seul un nouveau lien peut aboutir.
          setLinkDead(true)
        } else {
          // Erreur de validation avant toute validation du token : il reste utilisable.
          setError(json?.error ?? 'La mise à jour a échoué. Réessayez.')
        }
        return
      }
      setDone(true)
      // Navigation complète : les Server Components relisent le cookie de session
      setTimeout(() => {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- rechargement complet voulu, router.push garderait l'ancienne session
        window.location.href = '/accueil'
      }, 1500)
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-[var(--app-h)] flex items-center justify-center px-4
                    bg-gradient-to-b from-white to-brand-50
                    dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )

  if (linkDead) {
    return shell(
      <div className="text-center">
        <AlertCircle className="mx-auto mb-4 text-orange-500" size={56} />
        <h2 className="text-2xl font-bold mb-2">Lien invalide ou expiré</h2>
        <p className="text-gray-500 mb-6">
          Ce lien de renouvellement n&apos;est plus valable : il a déjà servi, ou son délai d&apos;une heure
          est dépassé. Vous pouvez en demander un nouveau.
        </p>
        <Link href="/auth/forgot-password" className="inline-flex items-center gap-2 bg-brand-600 text-white font-semibold px-8 py-3 rounded-2xl hover:bg-brand-700 transition-colors">
          Demander un nouveau lien
        </Link>
      </div>
    )
  }

  if (done) {
    return shell(
      <div className="text-center">
        <CheckCircle className="mx-auto mb-4 text-brand-600" size={56} />
        <h2 className="text-2xl font-bold mb-2">Mot de passe mis à jour</h2>
        <p className="text-gray-500">Vous êtes connecté, redirection vers l&apos;accueil…</p>
      </div>
    )
  }

  return shell(
    <>
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🔑</div>
        <h1 className="text-2xl font-bold text-gray-900">Nouveau mot de passe</h1>
        <p className="text-gray-500 mt-1">Choisissez un mot de passe d&apos;au moins 8 caractères.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
                placeholder="Min. 8 caractères"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Enregistrement...
              </>
            ) : (
              'Enregistrer le mot de passe'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Vous n&apos;avez rien demandé ?{' '}
          <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">
            Ignorez ce lien, votre mot de passe reste inchangé
          </Link>
        </p>
      </div>
    </>
  )
}
