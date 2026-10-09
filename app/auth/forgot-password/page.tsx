'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(json?.error ?? 'La demande a échoué. Réessayez dans un instant.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-[var(--app-h)] flex items-center justify-center px-4
                      bg-gradient-to-b from-white to-brand-50
                      dark:from-gray-950 dark:to-gray-900">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="mx-auto mb-4 text-brand-600" size={56} />
          <h2 className="text-2xl font-bold mb-2">Email envoyé</h2>
          <p className="text-gray-500 mb-2">
            Si un compte existe pour <strong className="text-gray-700">{email}</strong>, un lien pour
            choisir un nouveau mot de passe vient de lui être envoyé.
          </p>
          <p className="text-gray-500 mb-2 text-sm">
            Le lien est valable une heure. Pensez à vérifier vos courriers indésirables.
          </p>
          <p className="text-gray-400 mb-6 text-xs">
            Rien reçu après quelques minutes ? Refaites simplement la demande.
          </p>
          <Link href="/auth/login" className="inline-flex items-center gap-2 bg-brand-600 text-white font-semibold px-8 py-3 rounded-2xl hover:bg-brand-700 transition-colors">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[var(--app-h)] flex items-center justify-center px-4
                    bg-gradient-to-b from-white to-brand-50
                    dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔑</div>
          <h1 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h1>
          <p className="text-gray-500 mt-1">
            Indiquez votre email, nous vous envoyons un lien pour le renouveler.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="vous@exemple.com"
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
                  <Loader2 size={18} className="animate-spin" /> Envoi...
                </>
              ) : (
                'Envoyer le lien'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
