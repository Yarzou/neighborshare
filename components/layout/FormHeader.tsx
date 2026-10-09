import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Barre de titre d'un formulaire plein écran, façon feuille iOS (2026-10-07) :
 * « Annuler » en haut à gauche, titre centré. Demande utilisateur : un lien
 * « ← Retour aux événements » en tête de page, « c'est naze » ; un « Annuler » en
 * haut à gauche est plus parlant, « à la Apple ».
 *
 * Collée en haut pendant le défilement (sous la barre du haut mobile, d'où
 * `--nav-top`), en verre pour laisser deviner le formulaire qui passe dessous.
 * À poser comme premier enfant d'un conteneur `px-4` : elle déborde de ses marges
 * pour couvrir toute sa largeur.
 *
 * `cancelHref` est une destination fixe et non un `router.back()` : on revient
 * toujours au même endroit (la liste des annonces, l'agenda…), même arrivé par
 * un lien direct.
 */
export function FormHeader({ title, cancelHref, className }: {
  title: string
  cancelHref: string
  className?: string
}) {
  return (
    <header
      className={cn(
        'sticky top-[var(--nav-top)] z-20 -mx-4 px-4 h-12 mb-4',
        'grid grid-cols-[1fr_auto_1fr] items-center gap-2',
        // Le verre de toute l'appli (`.glass`), collé aux bords : liseré en bas seulement
        'glass rounded-none border-x-0 border-t-0',
        className,
      )}
    >
      <Link href={cancelHref} className="justify-self-start py-2 pr-2 text-[17px] text-brand-600 hover:text-brand-700">
        Annuler
      </Link>
      <h1 className="text-[17px] font-semibold text-gray-900 truncate text-center">{title}</h1>
      {/* Colonne vide : garde le titre centré */}
      <span aria-hidden="true" />
    </header>
  )
}
