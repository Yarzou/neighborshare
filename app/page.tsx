import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin, ArrowRight, LogIn, CalendarDays } from 'lucide-react'
import { CATEGORY_LIST } from '@/lib/categories'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/accueil')

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-10
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

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-10">
        <Link
          href="/evenements"
          className="inline-flex items-center gap-2 bg-white border border-brand-300 text-brand-700 font-semibold px-7 py-3.5 rounded-2xl hover:bg-brand-50 transition-colors shadow-sm">
          <CalendarDays size={18} />
          Voir les événements
        </Link>
        <Link
          href="/map"
          className="inline-flex items-center gap-2 bg-brand-600 text-white font-semibold px-7 py-3.5 rounded-2xl hover:bg-brand-700 transition-colors shadow-md">
          <MapPin size={18} />
          Explorer les annonces
        </Link>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 font-semibold px-7 py-3.5 rounded-2xl hover:bg-gray-50 transition-colors">
          <LogIn size={18} />
          Se connecter
        </Link>
      </div>
      <Link
        href="/auth/register"
        className="text-brand-600 text-sm font-medium hover:underline underline-offset-4 mb-12">
        Pas encore de compte ? Créer un compte
        <ArrowRight size={14} className="inline ml-1" />
      </Link>

    </div>
  )
}
