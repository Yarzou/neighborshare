'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react'

function safeRedirectPath(value: string | null) {
  if (!value) return '/map'
  // Empêche les redirections externes (open redirect)
  if (!value.startsWith('/')) return '/map'
  // Optionnel: éviter la boucle vers login
  if (value.startsWith('/auth/login')) return '/map'
  return value
}

export default function LoginClient() {
  const searchParams = useSearchParams()

  const redirect = useMemo(() => safeRedirectPath(searchParams.get('redirect')), [searchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Cas fréquent: on arrive ici via un redirect de route protégée
  // (/auth/login?redirect=/listings/new) alors qu'une session existe déjà.
  // Dans ce cas, on renvoie directement vers la destination.
  useEffect(() => {
    let cancelled = false

    const go = async () => {
      const { data } = await supabase.auth.getSession()
      if (!cancelled && data.session) {
        // Full navigation so server components get the fresh session cookie
        window.location.href = redirect
      }
    }

    void go()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session && _event === 'SIGNED_IN') {
        window.location.href = redirect
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase, redirect])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message || 'Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    // Full page navigation so the middleware reads the fresh session cookie
    window.location.href = redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-brand-50 to-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏘️</div>
          <h1 className="text-2xl font-bold text-gray-900">Bon retour !</h1>
          <p className="text-gray-500 mt-1">Connectez-vous à NeighborShare</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="vous@exemple.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
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
                  <Loader2 size={18} className="animate-spin" /> Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{' '}
            <Link href="/auth/register" className="text-brand-600 font-medium hover:underline">
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

