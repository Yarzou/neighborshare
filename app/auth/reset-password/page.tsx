'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Loader2, Lock } from 'lucide-react'

/**
 * Page d'arrivée du lien « mot de passe oublié ».
 * /auth/confirm (type=recovery) a déjà posé la session : il ne reste qu'à
 * enregistrer le nouveau mot de passe via `updateUser`.
 */
export default function ResetPasswordPage() {
  const supabase = createClient()
  // null = session pas encore résolue ; évite d'afficher « lien invalide » le temps du getUser
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setHasSession(true)
    })

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setHasSession(!!data.user)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

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

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(
        error.code === 'same_password'
          ? "Le nouveau mot de passe doit être différent de l'ancien."
          : error.message || 'La mise à jour a échoué. Réessayez.'
      )
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    // Navigation complète : les Server Components relisent le cookie de session
    setTimeout(() => {
      window.location.href = '/accueil'
    }, 1500)
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center px-4
                    bg-gradient-to-b from-white to-brand-50
                    dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )

  if (hasSession === null) {
    return shell(
      <div className="flex justify-center text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  if (!hasSession) {
    return shell(
      <div className="text-center">
        <AlertCircle className="mx-auto mb-4 text-orange-500" size={56} />
        <h2 className="text-2xl font-bold mb-2">Lien invalide ou expiré</h2>
        <p className="text-gray-500 mb-6">
          Ce lien de renouvellement n&apos;est plus valable. Vous pouvez en demander un nouveau.
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
      </div>
    </>
  )
}
