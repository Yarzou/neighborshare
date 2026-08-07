import Link from 'next/link'
import { Compass } from 'lucide-react'

/**
 * `notFound()` est appelé depuis cinq pages (annonce, événement, édition
 * d'événement, profil public) et n'avait aucune page dédiée : le rendu par
 * défaut de Next s'affichait, en anglais et sans mise en page.
 */
export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center flex flex-col items-center gap-4">
      <Compass size={48} className="text-content-faint" />
      <h1 className="text-2xl font-bold text-content">Page introuvable</h1>
      <p className="text-sm text-content-soft">
        Cette page n&apos;existe pas, ou le contenu qu&apos;elle affichait a été supprimé.
      </p>
      <Link
        href="/accueil"
        className="mt-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}
