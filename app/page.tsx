import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * Accueil public, pour un visiteur sans compte. On n'y fait que se connecter ou
 * s'inscrire (2026-10-09) : les liens « Les événements » et « La carte du
 * quartier » sont retirés, puisque tout est réservé aux habitants (migration 030).
 */
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/accueil')

  return (
    <div className="min-h-[var(--app-h)] flex flex-col items-center justify-center px-4 py-10
                    bg-gradient-to-b from-white to-brand-50
                    dark:from-gray-950 dark:to-gray-900">

      {/* Headline */}
      <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-center text-gray-900 leading-tight mb-4">
          Partagez avec<br />vos voisins<br /> du Cèdre
      </h1>

      {/* Tagline */}
      <p className="text-lg text-gray-500 text-center mb-10">
        Outils · Services · Entraide
      </p>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-5">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 bg-brand-600 text-white font-semibold px-7 py-3.5 rounded-2xl hover:bg-brand-700 transition-colors shadow-md">
          <LogIn size={18} />
          Se connecter
        </Link>
      </div>

      {/* Les annonces ne sont plus lisibles sans compte (migration 030) : on l'annonce
          ici plutôt que de laisser le visiteur le découvrir en cliquant. */}
      <p className="text-sm text-gray-400 text-center max-w-sm mb-8">
        Les annonces et les événements sont réservés aux habitants du lotissement.
      </p>
      <Link
        href="/auth/register"
        className="text-brand-600 text-sm font-medium hover:underline underline-offset-4 mb-12">
        Pas encore de compte ? Créer un compte
        <ArrowRight size={14} className="inline ml-1" />
      </Link>

    </div>
  )
}
